package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.util.List;

/**
 * Decorator that adds exponential back-off to a certificate provider. When the delegate is blocked (a
 * {@link ScrapeException} whose message contains {@code blocked-}), the back-off records a block and subsequent
 * lookups skip this provider until the window expires. A successful lookup resets the back-off.
 */
final class BackoffCertificateSource implements CertificateSourcePort, Skippable {

    private final CertificateSourcePort delegate;
    private final ExponentialBackoff backoff;

    BackoffCertificateSource(CertificateSourcePort delegate, ExponentialBackoff backoff) {
        this.delegate = delegate;
        this.backoff = backoff;
    }

    @Override
    public boolean shouldSkip() {
        return backoff.shouldSkip();
    }

    @Override
    public List<CertificateRef> findCertificates(CertificateQuery query) {
        try {
            List<CertificateRef> rows = delegate.findCertificates(query);
            backoff.recordSuccess();
            return rows;
        } catch (RuntimeException e) {
            if (isBlocked(e)) {
                backoff.recordBlock();
            }
            throw e;
        }
    }

    private static boolean isBlocked(Throwable t) {
        String m = t == null || t.getMessage() == null ? "" : t.getMessage().toLowerCase(java.util.Locale.ROOT);
        return m.contains("blocked-");
    }
}
