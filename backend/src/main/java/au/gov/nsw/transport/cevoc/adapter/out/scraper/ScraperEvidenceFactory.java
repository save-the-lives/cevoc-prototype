package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import java.io.IOException;
import java.time.Clock;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;

/** Builds the scraper adapter from properties, so BeanConfig needs only a one-line bean. */
public final class ScraperEvidenceFactory {

    private static final Logger LOG = LoggerFactory.getLogger(ScraperEvidenceFactory.class);
    /** Looked up by name: the class only exists when built with the live-browser Maven profile. */
    static final String LIVE_FACTORY = "au.gov.nsw.transport.cevoc.adapter.out.scraper.live.PlaywrightSessionFactory";

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
        boolean live = liveRequested(env, s);
        RenderedPageSessionFactory sessions = NO_BROWSER;
        RegistrationProvider registrations = RegistrationProvider.none();
        if (live) {
            RenderedPageSessionFactory f = playwright(s, env.getProperty("cevoc.live-check.capture-dir", ""),
                    env.getProperty(p + "browser-headless", Boolean.class, true));
            if (f != null) {
                sessions = f;
                registrations = new RequestScopedRegistration();
            }
        }
        return new ScraperEvidenceLookupAdapter(s, sessions, new RevenueNswPageParser(), media, Clock.systemUTC(), registrations);
    }

    /** True only for browser=playwright AND both scraper flags on (cevoc.scraper.enabled, cevoc.scraper.evidence.enabled) and a usable config. */
    static boolean liveRequested(Environment env, ScraperSettings s) {
        return "playwright".equalsIgnoreCase(env.getProperty("cevoc.scraper.evidence.browser", "").trim())
                && env.getProperty("cevoc.scraper.enabled", Boolean.class, false) && s.usable();
    }

    /** Reflection keeps the default build free of any Playwright reference. Null when the profile is not active. */
    static RenderedPageSessionFactory playwright(ScraperSettings s, String captureDir, boolean headless) {
        try {
            return (RenderedPageSessionFactory) Class.forName(LIVE_FACTORY)
                    .getConstructor(ScraperSettings.class, String.class, boolean.class)
                    .newInstance(s, captureDir, headless);
        } catch (ReflectiveOperationException | LinkageError e) {
            LOG.warn("cevoc.scraper.evidence.browser=playwright but the live-browser build profile is not active; "
                    + "the evidence scraper stays unavailable");
            return null;
        }
    }

    /**
     * The default: no browser adapter is installed (the Playwright one exists only in the opt-in live-browser build), so even a fully enabled configuration cannot open
     * a session: the lookup reports UNAVAILABLE and makes no network call.
     */
    private static final RenderedPageSessionFactory NO_BROWSER = baseUrl -> {
        throw new IOException("no headless-browser adapter is installed");
    };
}
