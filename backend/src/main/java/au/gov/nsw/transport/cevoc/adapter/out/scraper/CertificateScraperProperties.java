package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;

/** Settings for the certificate scraper. Defaults are deliberately conservative. */
public record CertificateScraperProperties(
        String pageUrl,
        String userAgent,
        Duration minInterval,
        Duration connectTimeout,
        Duration requestTimeout,
        Duration cacheTtl,
        CertificateKeyStrategy keyStrategy,
        Duration windowMargin) {

    public static final String DEFAULT_PAGE_URL =
            "https://apps.basint.transport.nsw.gov.au/cevoc/pages/sdro/searchCertificates.jsf";
    public static final String DEFAULT_USER_AGENT =
            "CEVOC-prototype-certificate-check/0.1 (+https://github.com/save-the-lives/cevoc-prototype; contact: set cevoc.scraper.certificates.user-agent)";

    /** windowMargin null = whole offence day (00:00 to 23:59). */
    public CertificateScraperProperties(String pageUrl, String userAgent, Duration minInterval, Duration connectTimeout,
                                        Duration requestTimeout, Duration cacheTtl, CertificateKeyStrategy keyStrategy) {
        this(pageUrl, userAgent, minInterval, connectTimeout, requestTimeout, cacheTtl, keyStrategy, null);
    }

    public CertificateScraperProperties {
        if (minInterval.compareTo(Duration.ofSeconds(2)) < 0) {
            throw new IllegalArgumentException("cevoc.scraper.certificates.min-interval-ms must be at least 2000");
        }
        if (windowMargin != null && (windowMargin.isNegative() || windowMargin.compareTo(Duration.ofHours(24)) > 0)) {
            throw new IllegalArgumentException("cevoc.scraper.certificates.window-margin-minutes must be between 0 and 1440");
        }
        if (cacheTtl.compareTo(Duration.ofMinutes(10)) > 0) {
            throw new IllegalArgumentException("cevoc.scraper.certificates.cache-ttl-seconds must be at most 600 (short cache)");
        }
    }

    /** {@code locationCode} is the camera code printed in the evidence image banner, used as is. Builds the query window for an offence using the configured margin (null = whole offence day). */
    public CertificateQuery queryFor(String locationCode, LocalDate offenceDate, LocalTime offenceTime) {
        return CertificateQuery.aroundOffence(locationCode, offenceDate, offenceTime, windowMargin);
    }
}
