package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import org.springframework.core.env.Environment;

/** Builds the scraper adapter from properties, so BeanConfig needs only a one-line bean. */
public final class ScraperEvidenceFactory {

    private ScraperEvidenceFactory() {}

    public static PenaltyLookupPort create(Environment env, MediaStoragePort media) {
        String p = "cevoc.scraper.evidence.";
        ScraperSettings s = new ScraperSettings(
                env.getProperty(p + "enabled", Boolean.class, false),
                env.getProperty(p + "base-url", ""),
                env.getProperty(p + "contact", ""),
                Duration.ofMillis(env.getProperty(p + "min-interval-ms", Long.class, ScraperSettings.DEFAULT_MIN_INTERVAL.toMillis())),
                Duration.ofMillis(env.getProperty(p + "connect-timeout-ms", Long.class, ScraperSettings.DEFAULT_CONNECT_TIMEOUT.toMillis())),
                Duration.ofMillis(env.getProperty(p + "request-timeout-ms", Long.class, ScraperSettings.DEFAULT_REQUEST_TIMEOUT.toMillis())),
                Duration.ofSeconds(env.getProperty(p + "cache-ttl-seconds", Long.class, ScraperSettings.DEFAULT_CACHE_TTL.toSeconds())),
                env.getProperty(p + "max-bytes", Long.class, ScraperSettings.DEFAULT_MAX_BYTES));
        if (!s.usable()) {
            return new ScraperEvidenceLookupAdapter(s, uri -> {
                throw new IllegalStateException("scraper is off; no network access");
            }, new RevenueNswPageParser(), media, Clock.systemUTC());
        }
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(s.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
        RateLimiter limiter = RateLimiter.system(s.minInterval());
        PageFetcher fetcher = new PoliteHttpFetcher(client, s.userAgent(), s.requestTimeout(), s.maxBytes(), limiter);
        return new ScraperEvidenceLookupAdapter(s, fetcher, new RevenueNswPageParser(), media, Clock.systemUTC());
    }
}
