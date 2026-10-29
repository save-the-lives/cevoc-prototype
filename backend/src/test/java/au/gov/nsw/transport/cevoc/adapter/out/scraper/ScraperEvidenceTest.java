package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
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
import java.util.Map;
import java.util.Optional;
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
        final List<URI> posted = new ArrayList<>();
        final List<Map<String, String>> forms = new ArrayList<>();
        String page;
        String imagesPage;

        @Override
        public Response get(URI uri) {
            requested.add(uri);
            if (uri.getPath().endsWith("image-1.jpg")) return new Response(200, "image/jpeg", new byte[] {1, 2, 3});
            if (uri.getPath().endsWith("image-2.jpg")) return new Response(200, "image/jpeg", new byte[] {4, 5});
            return new Response(200, "text/html", page.getBytes(StandardCharsets.UTF_8));
        }

        @Override
        public Response post(URI uri, Map<String, String> form) {
            posted.add(uri);
            forms.add(form);
            return new Response(200, "text/html", imagesPage.getBytes(StandardCharsets.UTF_8));
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

    private static ScraperEvidenceLookupAdapter adapter(FakeFetcher fetcher, FakeStorage storage, RegistrationProvider plates) {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        return new ScraperEvidenceLookupAdapter(enabled(), fetcher, new RevenueNswPageParser(), storage, clock, plates);
    }

    private static FakeFetcher fetcher() throws IOException {
        FakeFetcher f = new FakeFetcher();
        f.page = fixture("fictitious-penalty-result.html");
        f.imagesPage = fixture("fictitious-images.html");
        return f;
    }

    @Test
    void withoutARegistrationOnlyNoticeDetailsAreReturnedAndNoSecondStepRuns() throws IOException {
        FakeFetcher fetcher = fetcher();
        FakeStorage storage = new FakeStorage();
        ScraperEvidenceLookupAdapter adapter = adapter(fetcher, storage, RegistrationProvider.none());

        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.notice().location()).isEqualTo("SAMPLE ROAD, SAMPLETOWN");
        assertThat(r.evidence()).isEmpty();
        assertThat(r.cameraCode()).isNull();
        assertThat(fetcher.posted).isEmpty();
        assertThat(storage.keys).isEmpty();
        int callsAfterFirst = fetcher.requested.size();

        adapter.find(REQ);
        assertThat(fetcher.requested).hasSize(callsAfterFirst); // served from the short cache
    }

    @Test
    void withARegistrationRunsStepTwoBuffersSameHostImagesAndReadsCameraCode() throws IOException {
        FakeFetcher fetcher = fetcher();
        FakeStorage storage = new FakeStorage();
        // FICTITIOUS plate value, used only to prove it is sent in the form and goes nowhere else.
        ScraperEvidenceLookupAdapter adapter = adapter(fetcher, storage, req -> Optional.of("zz-00 aa"));

        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.cameraCode()).isEqualTo("TST001");
        assertThat(r.notice().enforcementMethod()).isEqualTo(EnforcementMethod.CAMERA);
        assertThat(r.evidence()).extracting(EvidenceItem::kind).containsExactly(EvidenceItem.Kind.IMAGE, EvidenceItem.Kind.IMAGE);
        assertThat(storage.keys).hasSize(2).allMatch(k -> k.startsWith("scraped/") && !k.contains("9000000099") && !k.toUpperCase().contains("ZZ"));
        assertThat(fetcher.requested).noneMatch(u -> u.getHost().contains("elsewhere"));
        assertThat(fetcher.posted).containsExactly(URI.create("https://penalty.example.invalid/fixture/images"));
        assertThat(fetcher.forms.get(0)).containsEntry("registration", "ZZ00AA").containsEntry("token", "fixture-token");
        // the plate is nowhere in the result
        assertThat(r.toString()).doesNotContain("ZZ00AA").doesNotContain("zz-00");
    }

    @Test
    void resultsThatUsedARegistrationAreNeverCached() throws IOException {
        FakeFetcher fetcher = fetcher();
        ScraperEvidenceLookupAdapter adapter = adapter(fetcher, new FakeStorage(), req -> Optional.of("ZZ00AA"));
        adapter.find(REQ);
        int posts = fetcher.posted.size();
        adapter.find(REQ);
        assertThat(fetcher.posted).hasSize(posts + 1);
    }

    @Test
    void implausibleRegistrationSkipsStepTwo() throws IOException {
        FakeFetcher fetcher = fetcher();
        ScraperEvidenceLookupAdapter adapter = adapter(fetcher, new FakeStorage(), req -> Optional.of("<script>"));
        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.evidence()).isEmpty();
        assertThat(fetcher.posted).isEmpty();
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
    void shippedConfigKeepsManifestAsDefaultAndScraperOff() throws IOException {
        Properties p = new Properties();
        try (InputStream in = Files.newInputStream(Path.of("src/main/resources/application.properties"))) {
            p.load(in);
        }
        assertThat(p.getProperty("cevoc.penalty-lookup.adapter")).isEqualTo("manifest");
        assertThat(p.getProperty("cevoc.scraper.evidence.enabled")).isEqualTo("false");
    }
}
