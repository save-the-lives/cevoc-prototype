package cevoc.adapter.out.scraper;

import cevoc.application.port.out.MediaStoragePort;
import cevoc.application.port.out.PenaltyLookupPort;
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
    static final String LIVE_FACTORY = "cevoc.adapter.out.scraper.live.PlaywrightSessionFactory";

    private ScraperEvidenceFactory() {}

    public static PenaltyLookupPort create(Environment env, MediaStoragePort media) {
        ScraperSettings s = settings(env);
        boolean live = liveRequested(env, s);
        RenderedPageSessionFactory sessions = NO_BROWSER;
        RegistrationProvider registrations = RegistrationProvider.none();
        if (live) {
            // Warm browser (default on): the Chromium process stays up between lookups on the same thread, each lookup still gets
            // a fresh context. cevoc.scraper.evidence.browser-warm=false restores a new browser per lookup.
            RenderedPageSessionFactory f = playwright(s, env.getProperty("cevoc.live-check.capture-dir", ""),
                    env.getProperty("cevoc.scraper.evidence.browser-headless", Boolean.class, true),
                    env.getProperty("cevoc.scraper.evidence.browser-warm", Boolean.class, true));
            if (f != null) {
                sessions = f;
                registrations = new RequestScopedRegistration();
            }
        }
        // The signed certification deep link answers 403 (observed), so it is used only when explicitly listed as a provider.
        return new ScraperEvidenceLookupAdapter(s, sessions, new RevenueNswPageParser(), media, Clock.systemUTC(), registrations)
                .followCertificationLink(CertificateProviders.ids(env).contains(CertificateProviders.BROWSER_LINK));
    }

    static ScraperSettings settings(Environment env) {
        String p = "cevoc.scraper.evidence.";
        return new ScraperSettings(
                env.getProperty(p + "enabled", Boolean.class, false),
                env.getProperty(p + "base-url", ""),
                env.getProperty(p + "contact", ""),
                Duration.ofMillis(env.getProperty(p + "min-interval-ms", Long.class, ScraperSettings.DEFAULT_MIN_INTERVAL.toMillis())),
                Duration.ofMillis(env.getProperty(p + "connect-timeout-ms", Long.class, ScraperSettings.DEFAULT_CONNECT_TIMEOUT.toMillis())),
                Duration.ofMillis(env.getProperty(p + "request-timeout-ms", Long.class, ScraperSettings.DEFAULT_REQUEST_TIMEOUT.toMillis())),
                Duration.ofSeconds(env.getProperty(p + "cache-ttl-seconds", Long.class, ScraperSettings.DEFAULT_CACHE_TTL.toSeconds())),
                env.getProperty(p + "max-bytes", Long.class, ScraperSettings.DEFAULT_MAX_BYTES));
    }

    /**
     * A browser session factory for other browser-based sources (the certificates search page). Same switches as the
     * evidence scraper (browser=playwright, both scraper flags, base URL and contact set): otherwise it refuses to open.
     */
    public static RenderedPageSessionFactory sessionsFor(Environment env) {
        ScraperSettings s = settings(env);
        if (liveRequested(env, s)) {
            RenderedPageSessionFactory f = playwright(s, env.getProperty("cevoc.live-check.capture-dir", ""),
                    env.getProperty("cevoc.scraper.evidence.browser-headless", Boolean.class, true));
            if (f != null) {
                return f;
            }
        }
        return NO_BROWSER;
    }

    /** True only for browser=playwright AND both scraper flags on (cevoc.scraper.enabled, cevoc.scraper.evidence.enabled) and a usable config. */
    static boolean liveRequested(Environment env, ScraperSettings s) {
        return "playwright".equalsIgnoreCase(env.getProperty("cevoc.scraper.evidence.browser", "").trim())
                && env.getProperty("cevoc.scraper.enabled", Boolean.class, false) && s.usable();
    }

    /** Reflection keeps the default build free of any Playwright reference. Null when the profile is not active. */
    static RenderedPageSessionFactory playwright(ScraperSettings s, String captureDir, boolean headless) {
        return playwright(s, captureDir, headless, false);
    }

    static RenderedPageSessionFactory playwright(ScraperSettings s, String captureDir, boolean headless, boolean warm) {
        try {
            if (warm) {
                return (RenderedPageSessionFactory) Class.forName(LIVE_FACTORY)
                        .getConstructor(ScraperSettings.class, String.class, boolean.class, boolean.class)
                        .newInstance(s, captureDir, headless, true);
            }
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
