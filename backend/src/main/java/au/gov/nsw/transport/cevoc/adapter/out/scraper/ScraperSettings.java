package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.time.Duration;

/**
 * Settings for the evidence scraper. Everything defaults to the safe/off position.
 * The scraper does nothing unless {@code enabled} is true AND a base URL and a contact are supplied.
 */
public record ScraperSettings(
        boolean enabled,
        String baseUrl,
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
        return new ScraperSettings(false, "", "", DEFAULT_MIN_INTERVAL, DEFAULT_CONNECT_TIMEOUT,
                DEFAULT_REQUEST_TIMEOUT, DEFAULT_CACHE_TTL, DEFAULT_MAX_BYTES);
    }

    /** True only when explicitly enabled and configured well enough to identify ourselves. */
    public boolean usable() {
        return enabled && baseUrl != null && !baseUrl.isBlank() && contact != null && !contact.isBlank();
    }

    /** Identifies us honestly so the site owner can see who is calling and contact us. */
    public String userAgent() {
        return "CEVOC-prototype/0.1 (Transport for NSW; contact: " + contact + ")";
    }
}
