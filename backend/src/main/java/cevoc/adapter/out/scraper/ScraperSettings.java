package cevoc.adapter.out.scraper;

import java.time.Duration;

/**
 * Settings for the Chromium (browser) evidence route. There is no on/off flag: the route exists only when it is selected
 * ({@code cevoc.penalty-lookup.adapter=browser}, the default). The URL has a fully qualified default ({@link #DEFAULT_URL});
 * the contact has none and is required: without it the route does nothing and says so in the start-up log.
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

    /**
     * Where the lookup goes when {@code cevoc.scraper.evidence.url} is empty or unset: the Revenue NSW login page (host as observed
     * in the structure-only network map, docs/DIRECT-API-ROUTE.md; path as the Chromium session already used).
     */
    public static final String DEFAULT_URL = "https://www.apps09.revenue.nsw.gov.au/customer_service/finesonline/";
    public static final Duration DEFAULT_MIN_INTERVAL = Duration.ofSeconds(5);
    public static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    public static final Duration DEFAULT_REQUEST_TIMEOUT = Duration.ofSeconds(15);
    public static final Duration DEFAULT_CACHE_TTL = Duration.ofSeconds(120);
    public static final long DEFAULT_MAX_BYTES = 25L * 1024 * 1024;

    /** Fully off: the default address, no contact. */
    public static ScraperSettings off() {
        return new ScraperSettings(DEFAULT_URL, "", DEFAULT_MIN_INTERVAL, DEFAULT_CONNECT_TIMEOUT,
                DEFAULT_REQUEST_TIMEOUT, DEFAULT_CACHE_TTL, DEFAULT_MAX_BYTES);
    }

    /** True only when configured well enough to know where to go and to identify ourselves. */
    public boolean usable() {
        return url != null && !url.isBlank() && contact != null && !contact.isBlank();
    }

    /** Identifies us honestly so the site owner can see who is calling and contact us. */
    public String userAgent() {
        return "CEVOC/1.0 (contact: " + contact + ")";
    }
}
