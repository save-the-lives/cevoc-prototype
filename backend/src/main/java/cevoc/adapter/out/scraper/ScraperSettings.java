package cevoc.adapter.out.scraper;

import java.time.Duration;

/**
 * Settings for the Chromium (browser) evidence route. There is no on/off flag: the route exists only when it is selected
 * ({@code cevoc.penalty-lookup.adapter=browser}), and it does nothing unless a URL and a contact are supplied.
 * {@code url} is the one fully qualified address of the site's login page (env CEVOC_SCRAPER_EVIDENCE_URL).
 */
public record ScraperSettings(
        String url,
        String contact,
        Duration minInterval,
        Duration connectTimeout,
        Duration requestTimeout,
        Duration cacheTtl,
        long maxBytes) {

    public static final Duration DEFAULT_MIN_INTERVAL = Duration.ofSeconds(5);
    public static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    public static final Duration DEFAULT_REQUEST_TIMEOUT = Duration.ofSeconds(15);
    public static final Duration DEFAULT_CACHE_TTL = Duration.ofSeconds(120);
    public static final long DEFAULT_MAX_BYTES = 25L * 1024 * 1024;

    /** Fully off. */
    public static ScraperSettings off() {
        return new ScraperSettings("", "", DEFAULT_MIN_INTERVAL, DEFAULT_CONNECT_TIMEOUT,
                DEFAULT_REQUEST_TIMEOUT, DEFAULT_CACHE_TTL, DEFAULT_MAX_BYTES);
    }

    /** True only when configured well enough to know where to go and to identify ourselves. */
    public boolean usable() {
        return url != null && !url.isBlank() && contact != null && !contact.isBlank();
    }

    /** Identifies us honestly so the site owner can see who is calling and contact us. */
    public String userAgent() {
        return "cevoc-prototype/1.0 (contact: " + contact + ")";
    }
}
