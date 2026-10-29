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
    void readsViewStateAndBuildsPost() {
        var state = parser.parseForm(fixture("search-form.html"), "https://example.invalid/cevoc/pages/sdro/searchCertificates.jsf");
        assertEquals("FICTITIOUS-VIEWSTATE-1", state.viewState());
        Map<String, String> post = parser.buildSearchPost(state, "TEST-PEN-1", null);
        assertEquals("TEST-PEN-1", post.get(CertificatePageParser.PENALTY_INPUT));
        assertEquals("FICTITIOUS-VIEWSTATE-1", post.get("javax.faces.ViewState"));
        assertTrue(post.containsKey(CertificatePageParser.SEARCH_BUTTON));
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
    void parsesSitesAndNoResults() {
        assertEquals("TEST-SITE-01", parser.parseSites(fixture("results-sites.html")).get(0).siteNumber());
        assertTrue(parser.hasNoResults(fixture("no-results.html")));
        assertTrue(parser.parseCertificates(fixture("no-results.html")).isEmpty());
    }
}
