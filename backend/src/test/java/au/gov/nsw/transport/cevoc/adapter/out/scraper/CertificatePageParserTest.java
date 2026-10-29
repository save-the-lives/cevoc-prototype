package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import au.gov.nsw.transport.cevoc.domain.CertificateMatch;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
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
}
