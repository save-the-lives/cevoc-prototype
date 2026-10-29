package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import java.io.IOException;
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
        return new ScraperEvidenceLookupAdapter(s, NO_BROWSER, new RevenueNswPageParser(), media, Clock.systemUTC());
    }

    /**
     * No headless-browser adapter exists yet (the next step), so even a fully enabled configuration cannot open
     * a session: the lookup reports UNAVAILABLE and makes no network call.
     */
    private static final RenderedPageSessionFactory NO_BROWSER = baseUrl -> {
        throw new IOException("no headless-browser adapter is installed");
    };
}
