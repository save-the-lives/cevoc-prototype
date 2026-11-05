package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;

/**
 * Builds the certificate source from {@code cevoc.certificates.providers}, the certificates adapter choice: an ordered,
 * comma-separated list using the same names as the lookup adapter ({@code cevoc.penalty-lookup.adapter}):
 * <ul>
 *   <li>{@code http}: the certificates search page with plain HTTP (GET, read the JSF hidden fields, POST the search form), no browser; interim;</li>
 *   <li>{@code browser}: the public certificates search page in a headless Chromium (interim, owner-approved 2026-11-04);</li>
 *   <li>{@code api}: reserved for the TfNSW API route; not available yet, so listing it fails at start-up;</li>
 *   <li>{@code http-form}: the older plain HTTP form scraper (legacy; only when listed);</li>
 *   <li>{@code browser-link}: follows the evidence page's signed link (legacy, answers 403; keep it last, it only parses a page the evidence step handed over).</li>
 * </ul>
 * Nothing listed (the default) means no certificate source at all. A name that is not in this list (including the retired
 * names {@code search-page} and {@code search-page-http}) is ignored with a warning: there is no alias and it never stops start-up.
 * An approval reference ({@code cevoc.certificates.approval-reference}) is an optional recorded note only: it is logged
 * at start-up when present and nothing is ever refused for lack of it.
 */
public final class CertificateProviders {

    public static final String BROWSER = "browser";
    public static final String API = "api";
    public static final String HTTP = "http";
    public static final String HTTP_FORM = "http-form";
    public static final String BROWSER_LINK = "browser-link";

    private static final Logger LOG = LoggerFactory.getLogger(CertificateProviders.class);

    private static final java.util.Set<String> KNOWN = java.util.Set.of(BROWSER, HTTP, API, HTTP_FORM, BROWSER_LINK);

    private CertificateProviders() {}

    /** The configured provider ids that are known, in order. Empty list when none are configured. */
    public static List<String> ids(Environment env) {
        String raw = env.getProperty("cevoc.certificates.providers", "").trim();
        List<String> out = new ArrayList<>();
        for (String part : raw.split(",")) {
            String id = part.trim().toLowerCase(Locale.ROOT);
            if (id.isEmpty() || out.contains(id)) {
                continue;
            }
            if (KNOWN.contains(id)) {
                out.add(id);
            } else {
                LOG.warn("certificate provider '{}' is not a known name and is ignored (known: http, browser, api, http-form, browser-link)", id);
            }
        }
        return out;
    }

    /** Null when no provider is configured. */
    public static CertificateSourcePort create(Environment env) {
        List<String> ids = ids(env);
        if (ids.isEmpty()) {
            return null;
        }
        if (ids.contains(BROWSER) || ids.contains(BROWSER_LINK)) {
            LOG.warn("A browser-based certificate provider is active. This is PROTOTYPE-ONLY: production uses the API providers, "
                    + "and the Chromium route is removed at cutover (see docs/ARCHITECTURE.md).");
        }
        List<CertificateSourcePort> ports = new ArrayList<>();
        for (String id : ids) {
            ports.add(switch (id) {
                case BROWSER -> searchPage(env);
                case HTTP -> searchPageHttp(env);
                case HTTP_FORM -> httpForm(env);
                case BROWSER_LINK -> new BrowserCertificateSourceAdapter(new CertificatePageParser());
                case API -> throw new IllegalStateException("certificate provider api is not available yet");
                default -> throw new IllegalStateException("unreachable: unknown certificate provider '" + id + "'");
            });
        }
        return ports.size() == 1 ? ports.get(0) : new CertificateProviderChain(ids, ports);
    }

    /** The optional approval reference: a recorded note only. Logged when present, never required. */
    private static void noteApproval(Environment env, String provider) {
        String ref = env.getProperty("cevoc.certificates.approval-reference", "").trim();
        if (!ref.isEmpty()) {
            LOG.info("certificate provider {} started; recorded approval note present", provider);
        }
    }

    private static CertificateSourcePort searchPage(Environment env) {
        noteApproval(env, BROWSER);
        String pageUrl = env.getProperty("cevoc.certificates.search-page.url", SearchPageCertificateSource.DEFAULT_PAGE_URL);
        Duration ttl = Duration.ofSeconds(env.getProperty("cevoc.certificates.cache-ttl-seconds", Long.class, 300L));
        return new SearchPageCertificateSource(ScraperEvidenceFactory.sessionsFor(env), pageUrl, new CertificatePageParser(), ttl,
                Clock.systemUTC());
    }

    private static CertificateSourcePort searchPageHttp(Environment env) {
        noteApproval(env, HTTP);
        ScraperSettings s = ScraperEvidenceFactory.settings(env);
        if (s.contact() == null || s.contact().isBlank()) {
            throw new IllegalStateException("cevoc.scraper.evidence.contact is required: the user agent must identify who is calling");
        }
        String pageUrl = env.getProperty("cevoc.certificates.search-page.url", SearchPageCertificateSource.DEFAULT_PAGE_URL);
        Duration ttl = Duration.ofSeconds(env.getProperty("cevoc.certificates.cache-ttl-seconds", Long.class, 300L));
        CertificateScraperProperties props = new CertificateScraperProperties(pageUrl, s.userAgent(), s.minInterval(),
                s.connectTimeout(), s.requestTimeout(), ttl, CertificateKeyStrategy.VIA_ENFORCEMENT_SITE);
        // A fresh fetcher per lookup: the session cookie lives in memory for that one lookup only.
        return new SearchPageHttpCertificateSource(() -> new PoliteHttpFetcher(props), pageUrl, new CertificatePageParser(),
                EvidenceRateLimiter.system(s.minInterval()), ttl, Clock.systemUTC());
    }

    private static CertificateSourcePort httpForm(Environment env) {
        noteApproval(env, HTTP_FORM);
        String p = "cevoc.scraper.certificates.";
        long margin = env.getProperty(p + "window-margin-minutes", Long.class, -1L);
        CertificateScraperProperties props = new CertificateScraperProperties(
                env.getProperty(p + "page-url", CertificateScraperProperties.DEFAULT_PAGE_URL),
                env.getProperty(p + "user-agent", CertificateScraperProperties.DEFAULT_USER_AGENT),
                Duration.ofMillis(env.getProperty(p + "min-interval-ms", Long.class, 5000L)),
                Duration.ofMillis(env.getProperty(p + "connect-timeout-ms", Long.class, 5000L)),
                Duration.ofMillis(env.getProperty(p + "request-timeout-ms", Long.class, 10000L)),
                Duration.ofSeconds(env.getProperty(p + "cache-ttl-seconds", Long.class, 300L)),
                env.getProperty(p + "key-strategy", CertificateKeyStrategy.class, CertificateKeyStrategy.VIA_ENFORCEMENT_SITE),
                margin < 0 ? null : Duration.ofMinutes(margin));
        return new CertificateScraperAdapter(new PoliteHttpFetcher(props), new CertificatePageParser(), props, Clock.systemUTC());
    }
}
