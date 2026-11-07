package cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cevoc.domain.CertificateMatch;
import cevoc.domain.CertificateRef;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Fictitious saved fixtures only. Never calls the live site. */
class CertificatePageParserTest {

    private final CertificatePageParser parser = new CertificatePageParser();

    static String fixture(String name) {
        try (InputStream in = CertificatePageParserTest.class.getResourceAsStream("/scraper/certificates/" + name)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void readsViewStateAndBuildsLocationPost() {
        var state = parser.parseForm(fixture("search-form.html"), "https://example.invalid/cevoc/pages/sdro/searchCertificates.jsf");
        assertEquals("FICTITIOUS-VIEWSTATE-1", state.viewState());
        Map<String, String> post = parser.buildSearchPost(state, "TEST-LOC-01",
                LocalDateTime.of(2026, 10, 30, 0, 0), LocalDateTime.of(2026, 10, 30, 23, 59));
        assertEquals("TEST-LOC-01", post.get(CertificatePageParser.LOCATION_CODE_INPUT));
        assertEquals("30/10/2026 00:00", post.get(CertificatePageParser.DATE_FROM_INPUT));
        assertEquals("30/10/2026 23:59", post.get(CertificatePageParser.DATE_TO_INPUT));
        assertEquals("FICTITIOUS-VIEWSTATE-1", post.get("javax.faces.ViewState"));
        assertTrue(post.containsKey(CertificatePageParser.SEARCH_BUTTON));
    }

    @Test
    void mandatoryFieldsAreEnforced() {
        var state = parser.parseForm(fixture("search-form.html"), "https://example.invalid/");
        var t = LocalDateTime.of(2026, 10, 30, 6, 25);
        assertThrows(IllegalArgumentException.class, () -> parser.buildSearchPost(state, " ", t, t));
        assertThrows(IllegalArgumentException.class, () -> parser.buildSearchPost(state, "TEST-LOC-01", null, t));
        assertThrows(IllegalArgumentException.class, () -> parser.buildSearchPost(state, "TEST-LOC-01", t, null));
    }

    @Test
    void legacyPenaltyPostStillBuilds() {
        var state = parser.parseForm(fixture("search-form.html"), "https://example.invalid/");
        assertEquals("TEST-PEN-1", parser.buildPenaltySearchPost(state, "TEST-PEN-1").get(CertificatePageParser.PENALTY_INPUT));
    }

    @Test
    void missingFormIsAScrapeException() {
        assertThrows(ScrapeException.class, () -> parser.parseForm("<html></html>", "https://example.invalid/"));
    }

    private static final LocalDateTime OFFENCE = LocalDateTime.of(2026, 10, 30, 11, 12, 13);

    @Test
    void parsesAllFiveColumns() {
        List<CertificateRef> certs = parser.parseCertificates(fixture("results-certificates.html"));
        assertEquals(5, certs.size());
        CertificateRef a = certs.get(0);
        assertEquals("TEST camera certificate A", a.description());
        assertEquals("Camera", a.type());
        assertEquals("01/07/2026 00:00 - 31/12/2026 23:59", a.periodText());
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), a.periodFrom());
        assertEquals(LocalDateTime.of(2026, 12, 31, 23, 59), a.periodTo());
        assertEquals(LocalDateTime.of(2026, 7, 2, 9, 30), a.certifiedDate());
        assertEquals(LocalDateTime.of(2027, 12, 31, 0, 0), a.expiryDate());
        assertNull(a.documentRef(), "no download link in the table: nothing is constructed");
    }

    @Test
    void dateOnlyPeriodCoversWholeLastDayAndCopiesRealHref() {
        CertificateRef d = parser.parseCertificates(fixture("results-certificates.html")).get(3);
        assertEquals(LocalDateTime.of(2026, 10, 30, 0, 0), d.periodFrom());
        assertEquals(LocalTime.MAX, d.periodTo().toLocalTime());
        assertEquals("/docs/test-d.pdf", d.documentRef());
    }

    @Test
    void toleratesUnparseableValues() {
        CertificateRef e = parser.parseCertificates(fixture("results-certificates.html")).get(4);
        assertEquals("TEST certificate E", e.description());
        assertNull(e.type());
        assertNull(e.periodFrom());
        assertNull(e.periodTo());
        assertNull(e.certifiedDate());
        assertNull(e.expiryDate());
        assertFalse(e.covers(OFFENCE), "unknown window never covers");
    }

    @Test
    void columnsAreMatchedByHeaderNotPosition() {
        List<CertificateRef> certs = parser.parseCertificates(fixture("results-reordered.html"));
        assertEquals(1, certs.size());
        CertificateRef c = certs.get(0);
        assertEquals("TEST reordered certificate", c.description());
        assertEquals("Camera", c.type());
        assertEquals(LocalDateTime.of(2026, 11, 1, 0, 0), c.periodTo());
        assertEquals(LocalDateTime.of(2030, 1, 1, 0, 0), c.expiryDate());
        assertNull(c.documentRef(), "# links are not usable");
    }

    @Test
    void marksOnlyCoveringRowsAndKeepsFullList() {
        List<CertificateMatch> all = CertificateMatch.mark(parser.parseCertificates(fixture("results-certificates.html")), OFFENCE);
        assertEquals(5, all.size());
        assertEquals(List.of(true, false, false, true, false), all.stream().map(CertificateMatch::covering).toList());
        assertEquals("TEST camera certificate A", all.get(0).certificate().description());
    }

    @Test
    void periodEndsAreInclusive() {
        CertificateRef a = parser.parseCertificates(fixture("results-certificates.html")).get(0);
        assertTrue(a.covers(a.periodFrom()));
        assertTrue(a.covers(a.periodTo()));
        assertFalse(a.covers(a.periodFrom().minusMinutes(1)));
        assertFalse(a.covers(a.periodTo().plusMinutes(1)));
    }

    @Test
    void emptyDatatableMessageIsNoResults() {
        assertTrue(parser.hasNoResults(fixture("results-empty-message.html")));
        assertTrue(parser.parseCertificates(fixture("results-empty-message.html")).isEmpty());
    }

    @Test
    void missingResultsTableIsAScrapeException() {
        assertThrows(ScrapeException.class, () -> parser.parseCertificates("<html><body><p>Unexpected</p></body></html>"));
    }

    @Test
    void parsesNoResults() {
        assertTrue(parser.hasNoResults(fixture("no-results.html")));
        assertTrue(parser.parseCertificates(fixture("no-results.html")).isEmpty());
    }

    // --- Multi-format date parsing tests ---

    @Test
    void periodParsesSlashFormat() {
        LocalDateTime[] p = CertificatePageParser.period("01/07/2026 00:00 - 31/12/2026 23:59");
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 23, 59), p[1]);
    }

    @Test
    void periodParsesSlashDateOnly() {
        LocalDateTime[] p = CertificatePageParser.period("01/07/2026 - 31/12/2026");
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 0, 0).with(LocalTime.MAX), p[1]);
    }

    @Test
    void periodParsesDashNumericFormat() {
        LocalDateTime[] p = CertificatePageParser.period("01-07-2026 - 31-12-2026");
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 0, 0).with(LocalTime.MAX), p[1]);
    }

    @Test
    void periodParsesMonthNameSpaces() {
        LocalDateTime[] p = CertificatePageParser.period("1 Jul 2026 - 31 Dec 2026");
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 0, 0).with(LocalTime.MAX), p[1]);
    }

    @Test
    void periodParsesMonthNameDashes() {
        LocalDateTime[] p = CertificatePageParser.period("01-Jul-2026 - 31-Dec-2026");
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 0, 0).with(LocalTime.MAX), p[1]);
    }

    @Test
    void periodParsesMonthNameWithTime() {
        LocalDateTime[] p = CertificatePageParser.period("1 Jul 2026 09:00 - 31 Dec 2026 17:30");
        assertEquals(LocalDateTime.of(2026, 7, 1, 9, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 17, 30), p[1]);
    }

    @Test
    void periodParsesIsoFormat() {
        LocalDateTime[] p = CertificatePageParser.period("2026-07-01 - 2026-12-31");
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 0, 0).with(LocalTime.MAX), p[1]);
    }

    @Test
    void periodParsesIsoWithTime() {
        LocalDateTime[] p = CertificatePageParser.period("2026-07-01 09:00 - 2026-12-31 17:30");
        assertEquals(LocalDateTime.of(2026, 7, 1, 9, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 17, 30), p[1]);
    }

    @Test
    void periodParsesIsoWithT() {
        LocalDateTime[] p = CertificatePageParser.period("2026-07-01T09:00 - 2026-12-31T17:30");
        assertEquals(LocalDateTime.of(2026, 7, 1, 9, 0), p[0]);
        assertEquals(LocalDateTime.of(2026, 12, 31, 17, 30), p[1]);
    }

    @Test
    void periodReturnsNullForGarbage() {
        LocalDateTime[] p = CertificatePageParser.period("not a date at all");
        assertNull(p[0]);
        assertNull(p[1]);
    }

    @Test
    void dateTimeParsesMonthName() {
        assertEquals(LocalDateTime.of(2026, 3, 14, 0, 0), CertificatePageParser.dateTime("14 Mar 2026", false));
        assertEquals(LocalDateTime.of(2026, 3, 14, 0, 0).with(LocalTime.MAX), CertificatePageParser.dateTime("14-Mar-2026", true));
    }

    @Test
    void dateTimeParsesIso() {
        assertEquals(LocalDateTime.of(2026, 3, 14, 0, 0), CertificatePageParser.dateTime("2026-03-14", false));
        assertEquals(LocalDateTime.of(2026, 3, 14, 11, 30), CertificatePageParser.dateTime("2026-03-14 11:30", false));
    }

    @Test
    void dateTimeParsesMonthNameCaseInsensitive() {
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), CertificatePageParser.dateTime("1 JUL 2026", false));
        assertEquals(LocalDateTime.of(2026, 7, 1, 0, 0), CertificatePageParser.dateTime("1 jul 2026", false));
    }

    @Test
    void isKeywordPeriodMatchesKnownKeywords() {
        assertTrue(CertificatePageParser.isKeywordPeriod("YEARLY"));
        assertTrue(CertificatePageParser.isKeywordPeriod("Yearly"));
        assertTrue(CertificatePageParser.isKeywordPeriod("  MONTHLY  "));
        assertTrue(CertificatePageParser.isKeywordPeriod("ANNUAL"));
        assertTrue(CertificatePageParser.isKeywordPeriod("DAILY"));
        assertTrue(CertificatePageParser.isKeywordPeriod("BIENNIAL"));
        assertTrue(CertificatePageParser.isKeywordPeriod("TRIENNIAL"));
        assertFalse(CertificatePageParser.isKeywordPeriod("01/07/2026 00:00 - 31/12/2026 23:59"));
        assertFalse(CertificatePageParser.isKeywordPeriod("not a period"));
        assertFalse(CertificatePageParser.isKeywordPeriod(null));
        assertFalse(CertificatePageParser.isKeywordPeriod(""));
    }

    @Test
    void keywordPeriodFallsBackToCertifiedAndExpiryDates() {
        List<CertificateRef> certs = parser.parseCertificates(fixture("results-keyword-period.html"));
        assertEquals(3, certs.size());

        // "YEARLY" with certified 01/03/2025 and expiry 28/02/2026
        CertificateRef f = certs.get(0);
        assertEquals("TEST camera certificate F", f.description());
        assertEquals("YEARLY", f.periodText());
        assertEquals(LocalDateTime.of(2025, 3, 1, 0, 0), f.periodFrom());
        assertEquals(LocalDateTime.of(2026, 2, 28, 0, 0), f.periodTo());
        assertTrue(f.covers(LocalDateTime.of(2025, 6, 15, 12, 0)));
        assertFalse(f.covers(LocalDateTime.of(2026, 10, 30, 11, 12)));

        // "Yearly" (mixed case) with certified 01/03/2026 and expiry 28/02/2027
        CertificateRef g = certs.get(1);
        assertEquals("Yearly", g.periodText());
        assertEquals(LocalDateTime.of(2026, 3, 1, 0, 0), g.periodFrom());
        assertTrue(g.covers(LocalDateTime.of(2026, 10, 30, 11, 12)));

        // "MONTHLY"
        CertificateRef h = certs.get(2);
        assertEquals("MONTHLY", h.periodText());
        assertNotNull(h.periodFrom());
        assertNotNull(h.periodTo());
    }

    @Test
    void periodStillReturnsNullForKeyword() {
        // period() itself doesn't handle keywords -- it just returns nulls
        LocalDateTime[] p = CertificatePageParser.period("YEARLY");
        assertNull(p[0]);
        assertNull(p[1]);
    }
}
