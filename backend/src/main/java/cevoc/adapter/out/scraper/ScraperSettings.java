package cevoc.adapter.out.scraper;

import java.time.Duration;

/**
 * Settings for the Chromium (browser) evidence route. There is no on/off flag: the route exists only when it is selected
 * ({@code cevoc.penalty-lookup.adapter=browser}, the default). The URL has a fully qualified default ({@link #DEFAULT_URL});
 * the contact has none and is optional: when set it is added to the User-Agent, when blank the route still runs.
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

    /** The defaults: the built-in address, no contact. Not "off": since record 0029 the address alone switches the route on.
     *  (Named off() until 2026-11-17, which no longer matched what it does.) */
    public static ScraperSettings defaults() {
        return new ScraperSettings(DEFAULT_URL, "", DEFAULT_MIN_INTERVAL, DEFAULT_CONNECT_TIMEOUT,
                DEFAULT_REQUEST_TIMEOUT, DEFAULT_CACHE_TTL, DEFAULT_MAX_BYTES);
    }

    /** True when there is an address to go to. The contact is optional (owner decision, 2026-11-17): it no longer gates the route. */
    public boolean usable() {
        return url != null && !url.isBlank();
    }

    /** Names the caller; carries the contact only when one is set (CEVOC_SCRAPER_EVIDENCE_CONTACT, optional). */
    public String userAgent() {
        return contact == null || contact.isBlank() ? "CEVOC/1.0" : "CEVOC/1.0 (contact: " + contact.trim() + ")";
    }
}
