package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.util.List;

/**
 * Wraps the plain-HTTP leg when a browser provider follows it in the chain: a refusal (blocked-401/403/429) of the HTTP leg
 * becomes an ordinary failure ({@code http-leg-refused-<status>}) so the chain hands over to the approved browser session
 * instead of stopping, the same rule as {@link HttpFirstCertificateSource} (decision 0023). The browser leg's own refusal
 * still stops the chain. Nothing is retried.
 */
final class HttpLegFallbackSource implements CertificateSourcePort {

    private final CertificateSourcePort http;

    HttpLegFallbackSource(CertificateSourcePort http) {
        this.http = http;
    }

    @Override
    public List<CertificateRef> findCertificates(CertificateQuery query) {
        try {
            return http.findCertificates(query);
        } catch (RuntimeException e) {
            if (CertificateProviderChain.isRefusal(e)) {
                String m = e.getMessage().toLowerCase(java.util.Locale.ROOT);
                String status = m.contains("blocked-401") ? "401" : m.contains("blocked-429") ? "429" : "403";
                throw new ScrapeException("http-leg-refused-" + status, e);
            }
            throw e;
        }
    }
}
