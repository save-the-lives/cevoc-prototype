package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

    @Test
    void parsesCertificatesAndToleratesBadDate() {
        List<CertificateRef> certs = parser.parseCertificates(fixture("results-certificates.html"));
        assertEquals(2, certs.size());
        assertEquals("TEST-CERT-0001", certs.get(0).certificateNumber());
        assertEquals(LocalDate.of(2024, 3, 5), certs.get(0).issuedDate());
        assertNull(certs.get(1).issuedDate());
    }

    @Test
    void parsesNoResults() {
        assertTrue(parser.hasNoResults(fixture("no-results.html")));
        assertTrue(parser.parseCertificates(fixture("no-results.html")).isEmpty());
    }
}
