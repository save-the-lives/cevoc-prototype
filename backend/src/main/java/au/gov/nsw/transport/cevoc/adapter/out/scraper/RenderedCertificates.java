package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.util.List;

/** Parses a rendered certificates page and records counts-only diagnostics. Shared by the browser-based providers. */
final class RenderedCertificates {

    private RenderedCertificates() {}

    static List<CertificateRef> parse(CertificatePageParser parser, String html) {
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
