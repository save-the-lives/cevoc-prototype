package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.time.Duration;

/** Settings for the certificate scraper. Defaults are deliberately conservative. */
public record CertificateScraperProperties(
        String pageUrl,
        String userAgent,
        Duration minInterval,
        Duration connectTimeout,
        Duration requestTimeout,
        Duration cacheTtl,
        CertificateKeyStrategy keyStrategy) {

    public static final String DEFAULT_PAGE_URL =
            "https://apps.basint.transport.nsw.gov.au/cevoc/pages/sdro/searchCertificates.jsf";
    public static final String DEFAULT_USER_AGENT =
            "CEVOC-prototype-certificate-check/0.1 (+https://github.com/save-the-lives/cevoc-prototype; contact: set cevoc.scraper.certificates.user-agent)";

    public CertificateScraperProperties {
        if (minInterval.compareTo(Duration.ofSeconds(2)) < 0) {
            throw new IllegalArgumentException("cevoc.scraper.certificates.min-interval-ms must be at least 2000");
        }
        if (cacheTtl.compareTo(Duration.ofMinutes(10)) > 0) {
            throw new IllegalArgumentException("cevoc.scraper.certificates.cache-ttl-seconds must be at most 600 (short cache)");
        }
    }
}
