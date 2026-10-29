package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Uses a fake fetcher serving fictitious fixtures: no network. */
class CertificateScraperAdapterTest {

    /** Serves the form on GET; on POST records the body and serves canned HTML. */
    static class FakeFetcher implements PageFetcher {
        final List<String> calls = new ArrayList<>();
        final List<Map<String, String>> posts = new ArrayList<>();
        final String response;

        FakeFetcher(String response) { this.response = response; }

        @Override public String get(String url) { calls.add("GET"); return CertificatePageParserTest.fixture("search-form.html"); }

        @Override public String postForm(String url, Map<String, String> f) {
            calls.add("POST");
            posts.add(f);
            return response;
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

    private static final LocalDate DAY = LocalDate.of(2026, 10, 30);

    @Test
    void defaultStrategyIsLocationAndWholeDayWindowAndCaches() {
        var f = new FakeFetcher(CertificatePageParserTest.fixture("results-certificates.html"));
        var clock = new MutableClock();
        var p = props(CertificateKeyStrategy.VIA_ENFORCEMENT_SITE);
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), p, clock);
        var q = p.queryFor("TEST-LOC-01", DAY, LocalTime.of(11, 12));
        assertEquals(2, a.findCertificates(q).size());
        a.findCertificates(q);
        assertEquals(List.of("GET", "POST"), f.calls, "second call served from cache");
        Map<String, String> post = f.posts.get(0);
        assertEquals("TEST-LOC-01", post.get(CertificatePageParser.LOCATION_CODE_INPUT));
        assertEquals("30/10/2026 00:00", post.get(CertificatePageParser.DATE_FROM_INPUT));
        assertEquals("30/10/2026 23:59", post.get(CertificatePageParser.DATE_TO_INPUT));
        clock.now = clock.now.plus(Duration.ofMinutes(6));
        a.findCertificates(q);
        assertEquals(4, f.calls.size(), "cache expired");
    }

    @Test
    void configuredMarginNarrowsWindow() {
        var p = new CertificateScraperProperties("https://example.invalid/page.jsf", "test-agent",
                Duration.ofSeconds(5), Duration.ofSeconds(5), Duration.ofSeconds(10), Duration.ofMinutes(5),
                CertificateKeyStrategy.VIA_ENFORCEMENT_SITE, Duration.ofMinutes(30));
        var q = p.queryFor("TEST-LOC-01", DAY, LocalTime.of(11, 12));
        assertEquals(LocalDateTime.of(2026, 10, 30, 10, 42), q.from());
        assertEquals(LocalDateTime.of(2026, 10, 30, 11, 42), q.to());
    }

    @Test
    void differentWindowIsNotServedFromCache() {
        var f = new FakeFetcher(CertificatePageParserTest.fixture("results-certificates.html"));
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), props(CertificateKeyStrategy.VIA_ENFORCEMENT_SITE), new MutableClock());
        a.findCertificates(CertificateQuery.aroundOffence("TEST-LOC-01", DAY, LocalTime.NOON, null));
        a.findCertificates(CertificateQuery.aroundOffence("TEST-LOC-01", DAY.plusDays(1), LocalTime.NOON, null));
        assertEquals(4, f.calls.size());
    }

    @Test
    void locationStrategyRequiresLocationAndWindow() {
        var f = new FakeFetcher("");
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), props(CertificateKeyStrategy.VIA_ENFORCEMENT_SITE), new MutableClock());
        assertThrows(IllegalArgumentException.class, () -> a.findCertificates(CertificateQuery.ofPenalty("TEST-PEN-1")));
        assertTrue(f.calls.isEmpty(), "no network call for an invalid query");
    }

    @Test
    void legacyByPenaltyStillWorksAgainstFixtures() {
        var f = new FakeFetcher(CertificatePageParserTest.fixture("results-certificates.html"));
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), props(CertificateKeyStrategy.BY_PENALTY), new MutableClock());
        assertEquals(2, a.findCertificates(CertificateQuery.ofPenalty("TEST-PEN-1")).size());
        assertEquals("TEST-PEN-1", f.posts.get(0).get(CertificatePageParser.PENALTY_INPUT));
    }

    @Test
    void noResultsGivesEmptyList() {
        var f = new FakeFetcher(CertificatePageParserTest.fixture("no-results.html"));
        var a = new CertificateScraperAdapter(f, new CertificatePageParser(), props(CertificateKeyStrategy.VIA_ENFORCEMENT_SITE), new MutableClock());
        assertTrue(a.findCertificates(CertificateQuery.aroundOffence("TEST-LOC-01", DAY, LocalTime.NOON, null)).isEmpty());
    }

    @Test
    void queryRejectsReversedWindow() {
        assertThrows(IllegalArgumentException.class, () -> CertificateQuery.ofLocation("TEST-LOC-01",
                LocalDateTime.of(2026, 10, 30, 12, 0), LocalDateTime.of(2026, 10, 30, 11, 0)));
    }

    @Test
    void rejectsImpoliteSettings() {
        assertThrows(IllegalArgumentException.class, () -> new CertificateScraperProperties("u", "a",
                Duration.ofMillis(100), Duration.ofSeconds(1), Duration.ofSeconds(1), Duration.ofSeconds(1), CertificateKeyStrategy.BY_PENALTY));
        assertThrows(IllegalArgumentException.class, () -> new CertificateScraperProperties("u", "a",
                Duration.ofSeconds(5), Duration.ofSeconds(1), Duration.ofSeconds(1), Duration.ofHours(1), CertificateKeyStrategy.BY_PENALTY));
    }
}
