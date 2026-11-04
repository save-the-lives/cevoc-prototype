package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.core.env.Environment;

/**
 * Builds the certificate source from {@code cevoc.certificates.providers}, an ordered, comma-separated list:
 * <ul>
 *   <li>{@code search-page-http}: the same search page with plain HTTP (GET, read the JSF hidden fields, POST the search form), no browser; interim;</li>
 *   <li>{@code search-page}: the public certificates search page in a headless browser (interim, owner-approved 2026-11-04);</li>
 *   <li>{@code tfnsw-api}: reserved for the TfNSW API route; not available yet, so listing it fails at start-up;</li>
 *   <li>{@code http-form}: the plain HTTP form scraper (legacy; also selected by cevoc.scraper.certificates.enabled=true when no list is given);</li>
 *   <li>{@code browser-link}: follows the evidence page's signed link (legacy, answers 403; keep it last, it only parses a page the evidence step handed over).</li>
 * </ul>
 * Nothing listed (the default) means no certificate source at all. The approval reference
 * ({@code cevoc.certificates.approval-reference}, or the older cevoc.scraper.certificates.approval-reference) is mandatory
 * for every provider that contacts the source.
 */
public final class CertificateProviders {

    public static final String SEARCH_PAGE = "search-page";
    public static final String TFNSW_API = "tfnsw-api";
    public static final String SEARCH_PAGE_HTTP = "search-page-http";
    public static final String HTTP_FORM = "http-form";
    public static final String BROWSER_LINK = "browser-link";

    private CertificateProviders() {}

    /** The configured provider ids, in order. Empty list when none are configured. */
    public static List<String> ids(Environment env) {
        String raw = env.getProperty("cevoc.certificates.providers", "").trim();
        List<String> out = new ArrayList<>();
        if (raw.isEmpty()) {
            if (env.getProperty("cevoc.scraper.certificates.enabled", Boolean.class, false)) {
                out.add(HTTP_FORM);
            }
            return out;
        }
        for (String part : raw.split(",")) {
            String id = part.trim().toLowerCase(Locale.ROOT);
            if (!id.isEmpty() && !out.contains(id)) {
                out.add(id);
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
        List<CertificateSourcePort> ports = new ArrayList<>();
        for (String id : ids) {
            ports.add(switch (id) {
                case SEARCH_PAGE -> searchPage(env);
                case SEARCH_PAGE_HTTP -> searchPageHttp(env);
                case HTTP_FORM -> httpForm(env);
                case BROWSER_LINK -> new BrowserCertificateSourceAdapter(new CertificatePageParser());
                case TFNSW_API -> throw new IllegalStateException("certificate provider tfnsw-api is not available yet");
                default -> throw new IllegalStateException("unknown certificate provider '" + id
                        + "' (known: search-page-http, search-page, http-form, browser-link)");
            });
        }
        return ports.size() == 1 ? ports.get(0) : new CertificateProviderChain(ids, ports);
    }

    private static String approval(Environment env) {
        String ref = env.getProperty("cevoc.certificates.approval-reference", "").trim();
        if (ref.isEmpty()) {
            ref = env.getProperty("cevoc.scraper.certificates.approval-reference", "").trim();
        }
        if (ref.isEmpty()) {
            throw new IllegalStateException("cevoc.certificates.approval-reference is required: the source's robots.txt "
                    + "disallows automated access, so record the owner's approval reference first");
        }
        return ref;
    }

    private static CertificateSourcePort searchPage(Environment env) {
        approval(env);
        String pageUrl = env.getProperty("cevoc.certificates.search-page.url", SearchPageCertificateSource.DEFAULT_PAGE_URL);
        Duration ttl = Duration.ofSeconds(env.getProperty("cevoc.certificates.cache-ttl-seconds", Long.class, 300L));
        return new SearchPageCertificateSource(ScraperEvidenceFactory.sessionsFor(env), pageUrl, new CertificatePageParser(), ttl,
                Clock.systemUTC());
    }

    private static CertificateSourcePort searchPageHttp(Environment env) {
        approval(env);
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
        approval(env);
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
