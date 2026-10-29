package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Uses a fake fetcher serving fictitious fixtures: no network. */
class CertificateScraperAdapterTest {

    /** Serves the form on GET; on POST serves canned HTML chosen by whether a site number was posted. */
    static class FakeFetcher implements PageFetcher {
        final List<String> calls = new ArrayList<>();
        final String penaltyOnlyResponse;
        final String withSiteResponse;

        FakeFetcher(String penaltyOnlyResponse, String withSiteResponse) {
            this.penaltyOnlyResponse = penaltyOnlyResponse;
            this.withSiteResponse = withSiteResponse;
        }

        @Override public String get(String url) { calls.add("GET"); return CertificatePageParserTest.fixture("search-form.html"); }

        @Override public String postForm(String url, Map<String, String> f) {
            calls.add("POST");
            return f.containsKey(CertificatePageParser.SITE_INPUT) ? withSiteResponse : penaltyOnlyResponse;
        }
    }

    static class MutableClock extends Clock {
        Instant now = Instant.parse("2030-01-01T00:00:00Z");
        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId z) { return this; }
        @Override public Instant instant() { return now; }
    }

    private static CertificateScraperProperties props(CertificateKeyStrategy s) {
        return new CertificateScraperProperties("https://example.invalid/page.jsf", "test-agent",
                Duration.ofSeconds(5), Duration.ofSeconds(5), Duration.ofSeconds(10), Duration.ofMinutes(5), s);
    }

    @Test
    void directByPenaltyAndCachesResult() {
        var f = new FakeFetcher(CertificatePageParserTest.fixture("results-certificates.html"), "");
        var clock = new MutableClock();
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), props(CertificateKeyStrategy.BY_PENALTY), clock);
        assertEquals(2, a.findCertificates(CertificateQuery.ofPenalty("TEST-PEN-1")).size());
        a.findCertificates(CertificateQuery.ofPenalty("TEST-PEN-1"));
        assertEquals(List.of("GET", "POST"), f.calls, "second call served from cache");
        clock.now = clock.now.plus(Duration.ofMinutes(6));
        a.findCertificates(CertificateQuery.ofPenalty("TEST-PEN-1"));
        assertEquals(4, f.calls.size(), "cache expired");
    }

    @Test
    void penaltyThenSiteThenCertificates() {
        var f = new FakeFetcher(CertificatePageParserTest.fixture("results-sites.html"),
                CertificatePageParserTest.fixture("results-certificates.html"));
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), props(CertificateKeyStrategy.VIA_ENFORCEMENT_SITE), new MutableClock());
        assertEquals(2, a.findCertificates(CertificateQuery.ofPenalty("TEST-PEN-2")).size());
        assertEquals(List.of("GET", "POST", "GET", "POST"), f.calls);
    }

    @Test
    void noResultsGivesEmptyList() {
        var f = new FakeFetcher(CertificatePageParserTest.fixture("no-results.html"), "");
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), props(CertificateKeyStrategy.BY_PENALTY), new MutableClock());
        assertTrue(a.findCertificates(CertificateQuery.ofPenalty("TEST-PEN-3")).isEmpty());
    }

    @Test
    void rejectsImpoliteSettings() {
        assertThrows(IllegalArgumentException.class, () -> new CertificateScraperProperties("u", "a",
                Duration.ofMillis(100), Duration.ofSeconds(1), Duration.ofSeconds(1), Duration.ofSeconds(1), CertificateKeyStrategy.BY_PENALTY));
        assertThrows(IllegalArgumentException.class, () -> new CertificateScraperProperties("u", "a",
                Duration.ofSeconds(5), Duration.ofSeconds(1), Duration.ofSeconds(1), Duration.ofHours(1), CertificateKeyStrategy.BY_PENALTY));
    }
}
