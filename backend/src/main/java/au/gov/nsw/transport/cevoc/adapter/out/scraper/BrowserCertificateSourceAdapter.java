package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.util.List;

/**
 * Certificate source for the browser route: it does no network call of its own. The evidence adapter follows the
 * page's certification link in the same Chromium session and hands the rendered certificates page over through
 * {@link CertificateHandoff}; this adapter only parses it. With nothing handed over (no images state, no link,
 * browser step failed) it returns an empty list. A page that is not recognisable throws ScrapeException, which the
 * lookup service turns into "Certificates unavailable" without failing the lookup.
 *
 * The list is returned whole, in page order; {@code findCertificatesCovering} (port default) marks the covering rows.
 */
public class BrowserCertificateSourceAdapter implements CertificateSourcePort {

    private final CertificatePageParser parser;

    public BrowserCertificateSourceAdapter(CertificatePageParser parser) {
        this.parser = parser;
    }

    @Override
    public List<CertificateRef> findCertificates(CertificateQuery query) {
        String html = CertificateHandoff.take();
        if (html == null) {
            return List.of();
        }
        return RenderedCertificates.parse(parser, html);
    }
}
