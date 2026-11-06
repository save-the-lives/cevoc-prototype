package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.time.Clock;
import java.time.Duration;
import java.util.List;

/**
 * Certificates {@code curl} provider (decision 0025): the same search as the {@code http} provider (GET the form, read the JSF view state
 * and field names, POST the search, parse the table) but every request is the {@code curl} command line program, whose TLS
 * fingerprint the bot management accepts. A fresh {@link CurlPageFetcher} (own cookie jar in a temp directory) per lookup, deleted
 * afterwards, success or failure. Any failure is an ordinary failure for the chain, which hands over to the next provider.
 */
public final class CurlCertificateSource implements CertificateSourcePort {

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(CurlCertificateSource.class);

    private final SearchPageHttpCertificateSource delegate;
    private CurlPageFetcher current;

    CurlCertificateSource(String curl, Duration timeout, String pageUrl, EvidenceRateLimiter limiter, Duration cacheTtl, Clock clock,
                          CurlPageFetcher.Runner runner) {
        this.delegate = new SearchPageHttpCertificateSource(() -> {
            current = new CurlPageFetcher(curl, timeout, runner);
            return current;
        }, pageUrl, new CertificatePageParser(), limiter, cacheTtl, clock);
    }

    @Override
    public synchronized List<CertificateRef> findCertificates(CertificateQuery query) {
        long started = System.nanoTime();
        try {
            List<CertificateRef> rows = delegate.findCertificates(query);
            LookupDiagnostic.note("cert-provider=curl");
            long withPeriod = rows.stream().filter(r -> r.periodFrom() != null).count();
            LOG.info("Certificate curl lookup ok: count={}, with-period={}, ms={}", rows.size(), withPeriod, (System.nanoTime() - started) / 1_000_000);
            if (withPeriod == 0 && !rows.isEmpty()) {
                // Log the format shape of the first period text (day separators only, no values) so we can fix the parser.
                String sample = rows.get(0).periodText();
                String shape = sample == null ? "null" : sample.replaceAll("\\d", "#");
                LOG.warn("Certificate period parse failed for all rows: period-shape={}", shape);
            }
            return rows;
        } catch (RuntimeException e) {
            LOG.warn("Certificate curl lookup failed: cause={}, ms={}", cevoc.domain.StepCause.of(e).token(), (System.nanoTime() - started) / 1_000_000);
            throw e;
        } finally {
            if (current != null) {
                current.close();
                current = null;
            }
        }
    }
}
