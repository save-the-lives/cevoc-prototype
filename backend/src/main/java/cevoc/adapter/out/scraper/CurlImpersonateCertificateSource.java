package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

/**
 * Certificates {@code curl-impersonate} provider: identical to the {@code curl} provider but invokes curl-impersonate
 * (Chrome variant), whose BoringSSL TLS fingerprint is indistinguishable from real Chrome. The binary accepts the same
 * flags as curl.
 */
public final class CurlImpersonateCertificateSource implements CertificateSourcePort {

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(CurlImpersonateCertificateSource.class);

    private final SearchPageHttpCertificateSource delegate;
    private CurlPageFetcher current;

    CurlImpersonateCertificateSource(String curl, Duration timeout, String pageUrl, long maxDelayMs, Duration cacheTtl, Clock clock,
                                     CurlPageFetcher.Runner runner) {
        this.delegate = new SearchPageHttpCertificateSource(() -> {
            current = new CurlPageFetcher(curl, timeout, runner);
            return current;
        }, pageUrl, new CertificatePageParser(), maxDelayMs, cacheTtl, clock);
    }

    @Override
    public synchronized List<CertificateRef> findCertificates(CertificateQuery query) {
        long started = System.nanoTime();
        try {
            List<CertificateRef> rows = delegate.findCertificates(query);
            LookupDiagnostic.note("cert-provider=curl-impersonate");
            long withPeriod = rows.stream().filter(r -> r.periodFrom() != null).count();
            LOG.info("Certificate curl-impersonate lookup ok: count={}, with-period={}, ms={}", rows.size(), withPeriod, (System.nanoTime() - started) / 1_000_000);
            if (withPeriod == 0 && !rows.isEmpty()) {
                String sample = rows.get(0).periodText();
                String shape = sample == null ? "null" : sample.replaceAll("\\d", "#");
                LOG.warn("Certificate period parse failed for all rows: period-shape={}", shape);
            }
            return rows;
        } catch (RuntimeException e) {
            LOG.warn("Certificate curl-impersonate lookup failed: cause={}, ms={}", cevoc.domain.StepCause.of(e).token(), (System.nanoTime() - started) / 1_000_000);
            throw e;
        } finally {
            if (current != null) {
                current.close();
                current = null;
            }
        }
    }
}
