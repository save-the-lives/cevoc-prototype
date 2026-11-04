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
        try {
            List<CertificateRef> rows = parser.parseRendered(html);
            long withPeriod = rows.stream().filter(r -> r.periodFrom() != null).count();
            long withCertified = rows.stream().filter(r -> r.certifiedDate() != null).count();
            long withExpiry = rows.stream().filter(r -> r.expiryDate() != null).count();
            LookupDiagnostic.note("step=certificates-parse; outcome=ok; rows=" + Math.min(rows.size(), 99)
                    + "; rows-with-period=" + Math.min(withPeriod, 99) + "; rows-with-certified=" + Math.min(withCertified, 99)
                    + "; rows-with-expiry=" + Math.min(withExpiry, 99));
            return rows;
        } catch (ScrapeException e) {
            LookupDiagnostic.note("step=certificates-parse; outcome=failed; cause=layout-not-recognised");
            throw e;
        }
    }
}
