package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;
import org.junit.jupiter.api.Test;

/** All tests use saved FICTITIOUS fixtures and fakes. Nothing here touches the network. */
class ScraperEvidenceTest {

    private static final String BASE = "https://penalty.example.invalid/lookup";
    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000099", LocalDate.of(2026, 1, 15));

    private static String fixture(String name) throws IOException {
        return Files.readString(Path.of("src/test/resources/fixtures/scraper/" + name), StandardCharsets.UTF_8);
    }

    private static ScraperSettings enabled() {
        return new ScraperSettings(true, BASE, "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), Duration.ofSeconds(60), 1024);
    }

    static class FakeFetcher implements EvidencePageFetcher {
        final List<URI> requested = new ArrayList<>();
        String page;

        @Override
        public Response get(URI uri) {
            requested.add(uri);
            if (uri.getPath().endsWith("image-1.jpg")) return new Response(200, "image/jpeg", new byte[] {1, 2, 3});
            if (uri.getPath().endsWith("video-1.mp4")) return new Response(200, "video/mp4", new byte[] {4, 5});
            return new Response(200, "text/html", page.getBytes(StandardCharsets.UTF_8));
        }
    }

    static class FakeStorage implements MediaStoragePort {
        final List<String> keys = new ArrayList<>();

        @Override
        public void store(String objectKey, String contentType, InputStream content, long contentLength) {
            keys.add(objectKey);
        }

        @Override
        public boolean exists(String objectKey) {
            return keys.contains(objectKey);
        }
    }

    @Test
    void parserReadsFictitiousFixture() throws IOException {
        RevenueNswPageParser.Parsed p = new RevenueNswPageParser().parse(fixture("fictitious-notice-page.html"));
        assertThat(p.outcome()).isEqualTo(RevenueNswPageParser.Outcome.FOUND);
        assertThat(p.notice().offenceDescription()).startsWith("Exceed speed limit");
        assertThat(p.notice().noticeStatus()).isEqualTo(NoticeStatus.PAYABLE);
        assertThat(p.notice().statusMessage()).contains("due & can");
        assertThat(p.notice().penaltyAmount()).isEqualByComparingTo("277.00");
        assertThat(p.media()).hasSize(3);
    }

    @Test
    void parserHandlesNoMatchAndGarbage() throws IOException {
        RevenueNswPageParser parser = new RevenueNswPageParser();
        assertThat(parser.parse(fixture("fictitious-no-match.html")).outcome()).isEqualTo(RevenueNswPageParser.Outcome.NOT_FOUND);
        assertThat(parser.parse("<html>site redesigned</html>").outcome()).isEqualTo(RevenueNswPageParser.Outcome.UNRECOGNISED);
        assertThat(parser.parse("").outcome()).isEqualTo(RevenueNswPageParser.Outcome.UNRECOGNISED);
    }

    @Test
    void buffersOnSameHostMediaOnlyAndCaches() throws IOException {
        FakeFetcher fetcher = new FakeFetcher();
        fetcher.page = fixture("fictitious-notice-page.html");
        FakeStorage storage = new FakeStorage();
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        ScraperEvidenceLookupAdapter adapter = new ScraperEvidenceLookupAdapter(enabled(), fetcher, new RevenueNswPageParser(), storage, clock);

        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.evidence()).extracting(EvidenceItem::kind)
                .containsExactly(EvidenceItem.Kind.IMAGE, EvidenceItem.Kind.VIDEO);
        assertThat(storage.keys).hasSize(2).allMatch(k -> k.startsWith("scraped/") && !k.contains("9000000099"));
        assertThat(fetcher.requested).noneMatch(u -> u.getHost().contains("elsewhere"));
        int callsAfterFirst = fetcher.requested.size();

        adapter.find(REQ);
        assertThat(fetcher.requested).hasSize(callsAfterFirst); // served from the short cache
    }

    @Test
    void doesNothingWhenNotEnabledOrNotConfigured() {
        FakeFetcher fetcher = new FakeFetcher();
        for (ScraperSettings s : List.of(ScraperSettings.off(),
                new ScraperSettings(false, BASE, "c@example.invalid", Duration.ZERO, Duration.ZERO, Duration.ZERO, Duration.ZERO, 1),
                new ScraperSettings(true, BASE, "", Duration.ZERO, Duration.ZERO, Duration.ZERO, Duration.ZERO, 1),
                new ScraperSettings(true, "", "c@example.invalid", Duration.ZERO, Duration.ZERO, Duration.ZERO, Duration.ZERO, 1))) {
            PenaltyLookupResult r = new ScraperEvidenceLookupAdapter(s, fetcher, new RevenueNswPageParser(),
                    new FakeStorage(), Clock.systemUTC()).find(REQ);
            assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
        }
        assertThat(fetcher.requested).isEmpty();
    }

    @Test
    void rateLimiterWaitsBetweenRequests() {
        long[] now = {0};
        List<Long> sleeps = new ArrayList<>();
        EvidenceRateLimiter limiter = new EvidenceRateLimiter(Duration.ofSeconds(5), () -> now[0], n -> {
            sleeps.add(n);
            now[0] += n;
        });
        limiter.acquire();
        now[0] += Duration.ofSeconds(2).toNanos();
        limiter.acquire();
        assertThat(sleeps).containsExactly(Duration.ofSeconds(3).toNanos());
    }

    @Test
    void userAgentIdentifiesUs() {
        assertThat(enabled().userAgent()).contains("CEVOC-prototype").contains("Transport for NSW").contains("contact:");
    }

    @Test
    void shippedConfigKeepsStubAsDefaultAndScraperOff() throws IOException {
        Properties p = new Properties();
        try (InputStream in = Files.newInputStream(Path.of("src/main/resources/application.properties"))) {
            p.load(in);
        }
        assertThat(p.getProperty("cevoc.penalty-lookup.adapter")).isEqualTo("stub");
        assertThat(p.getProperty("cevoc.scraper.evidence.enabled")).isEqualTo("false");
    }
}
