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
 *   <li>{@code curl}: the same search as {@code http} but each request is the {@code curl} command line program (TLS fingerprint the bot management accepts); first in the default chain (decision 0025);</li>
 *   <li>{@code http}: the certificates search page with plain HTTP (GET, read the JSF hidden fields, POST the search form), no browser; interim;</li>
 *   <li>{@code browser}: the public certificates search page in a headless Chromium (interim, owner-approved 2026-11-04);</li>
 *   <li>{@code api}: reserved for the TfNSW API route; not available yet, so listing it fails at start-up;</li>
 *   <li>{@code http-form}: the older plain HTTP form scraper (legacy; only when listed);</li>
 *   <li>{@code browser-link}: follows the evidence page's signed link (legacy, answers 403; keep it last, it only parses a page the evidence step handed over).</li>
 * </ul>
 * Nothing listed (empty or unset, the default) means {@code curl,http,browser}: curl first, then plain HTTP with browser headers, the browser as last fallback. The explicit value {@code none} means no certificate source
 * at all (tests, or a deployment that wants none). A name that is not in this list (including the retired
 * names {@code search-page} and {@code search-page-http}) is ignored with a warning: there is no alias and it never stops start-up.
 */
public final class CertificateProviders {

    public static final String BROWSER = "browser";
    public static final String API = "api";
    public static final String HTTP = "http";
    public static final String CURL = "curl";
    public static final String HTTP_FORM = "http-form";
    public static final String BROWSER_LINK = "browser-link";
    /** Explicit "no certificate source". */
    public static final String NONE = "none";

    private static final Logger LOG = LoggerFactory.getLogger(CertificateProviders.class);

    /** Fixed maximum random delay (ms) between the form GET and the search POST inside one certificate lookup. */
    private static final long INTRA_DELAY_MAX_MS = 1000L;

    private static final java.util.Set<String> KNOWN = java.util.Set.of(BROWSER, HTTP, CURL, API, HTTP_FORM, BROWSER_LINK);

    private CertificateProviders() {}

    /** The provider ids to use, in order: the configured known ones, or {@code curl,http,browser} when the setting is empty or unset. */
    public static List<String> ids(Environment env) {
        String raw = env.getProperty("cevoc.certificates.providers", "").trim();
        List<String> out = new ArrayList<>();
        if (raw.isEmpty()) {
            return List.of(CURL, HTTP, BROWSER);
        }
        for (String part : raw.split(",")) {
            String id = part.trim().toLowerCase(Locale.ROOT);
            if (id.isEmpty() || id.equals(NONE) || out.contains(id)) {
                continue;
            }
            if (KNOWN.contains(id)) {
                out.add(id);
            } else {
                LOG.warn("certificate provider '{}' is not a known name and is ignored (known: curl, http, browser, api, http-form, browser-link)", id);
            }
        }
        return out;
    }

    /** Null when the setting is {@code none} (or lists nothing known). */
    public static CertificateSourcePort create(Environment env) {
        List<String> ids = ids(env);
        String url = env.getProperty("cevoc.certificates.search-page.url", SearchPageCertificateSource.DEFAULT_PAGE_URL);
        if (ids.isEmpty()) {
            LOG.info("Certificate source: none configured (cevoc.certificates.providers lists no known provider)");
            return null;
        }
        LOG.info("Certificate source: providers={}, url={}", ids, url);
        if (ids.contains(BROWSER) || ids.contains(BROWSER_LINK)) {
            LOG.warn("A browser-based certificate provider is active (providers={}, url={}). This is TEMPORARY (interim route, removed when the TfNSW API exists): production uses the API providers, "
                    + "and the Chromium route is removed at cutover (see docs/ARCHITECTURE.md).", ids, url);
        }
        List<CertificateSourcePort> ports = new ArrayList<>();
        List<String> usedIds = new ArrayList<>();
        for (String id : ids) {
            CertificateSourcePort port = switch (id) {
                case BROWSER -> searchPage(env);
                case CURL -> {
                    CertificateSourcePort curl = curl(env);
                    yield curl != null && ids.indexOf(CURL) < ids.size() - 1 ? new HttpLegFallbackSource(curl) : curl;
                }
                case HTTP -> {
                    CertificateSourcePort http = searchPageHttp(env);
                    boolean browserFollows = ids.subList(ids.indexOf(HTTP) + 1, ids.size()).stream().anyMatch(i -> i.equals(BROWSER) || i.equals(BROWSER_LINK));
                    yield http != null && browserFollows ? new HttpLegFallbackSource(http) : http;
                }
                case HTTP_FORM -> httpForm(env);
                case BROWSER_LINK -> new BrowserCertificateSourceAdapter(new CertificatePageParser());
                case API -> throw new IllegalStateException("certificate provider api is not available yet");
                default -> throw new IllegalStateException("unreachable: unknown certificate provider '" + id + "'");
            };
            if (port != null) {
                ports.add(port);
                usedIds.add(id);
            }
        }
        if (ports.isEmpty()) {
            LOG.warn("Certificate source: no provider could be built (providers={}), so certificates will be skipped", ids);
            return null;
        }
        LOG.info("Certificate source ready: providers={}", usedIds);
        return ports.size() == 1 ? ports.get(0) : new CertificateProviderChain(usedIds, ports);
    }

    private static CertificateSourcePort searchPage(Environment env) {
        ScraperEvidenceFactory.logNotUsable(ScraperEvidenceFactory.settings(env), "the browser certificates provider");
        String pageUrl = env.getProperty("cevoc.certificates.search-page.url", SearchPageCertificateSource.DEFAULT_PAGE_URL);
        Duration ttl = Duration.ofSeconds(env.getProperty("cevoc.certificates.cache-ttl-seconds", Long.class, 300L));
        ScraperSettings s = ScraperEvidenceFactory.settings(env);
        if (!env.getProperty("cevoc.certificates.search-page.http-first", Boolean.class, true) || !s.usable()) {
            return new SearchPageCertificateSource(ScraperEvidenceFactory.sessionsFor(env), pageUrl, new CertificatePageParser(), ttl,
                    Clock.systemUTC());
        }
        // HTTP first with the cookies of the last browser visit; the browser is the fallback and refreshes them.
        SessionCookies store = new SessionCookies();
        SearchPageCertificateSource browser = new SearchPageCertificateSource(ScraperEvidenceFactory.sessionsFor(env), pageUrl,
                new CertificatePageParser(), ttl, Clock.systemUTC(), store);
        CertificateScraperProperties props = new CertificateScraperProperties(pageUrl, s.userAgent(), s.minInterval(),
                s.connectTimeout(), s.requestTimeout(), ttl, CertificateKeyStrategy.VIA_ENFORCEMENT_SITE);
        return new HttpFirstCertificateSource(store, Clock.systemUTC(),
                cookies -> new SearchPageHttpCertificateSource(() -> new PoliteHttpFetcher(props, true, cs -> store.put(cs, Clock.systemUTC().instant())).withCookies(pageUrl, cookies), pageUrl,
                        new CertificatePageParser(), INTRA_DELAY_MAX_MS, ttl, Clock.systemUTC()),
                browser);
    }

    private static CertificateSourcePort curl(Environment env) {
        ScraperSettings s = ScraperEvidenceFactory.settings(env);
        String pageUrl = env.getProperty("cevoc.certificates.search-page.url", SearchPageCertificateSource.DEFAULT_PAGE_URL);
        Duration ttl = Duration.ofSeconds(env.getProperty("cevoc.certificates.cache-ttl-seconds", Long.class, 300L));
        String command = env.getProperty("cevoc.certificates.curl.command", "curl");
        Duration timeout = Duration.ofSeconds(env.getProperty("cevoc.certificates.curl.timeout-seconds", Long.class, 10L));
        return new CurlCertificateSource(command.isBlank() ? "curl" : command.trim(), timeout, pageUrl, INTRA_DELAY_MAX_MS, ttl,
                Clock.systemUTC(), CurlPageFetcher.processRunner());
    }

    private static CertificateSourcePort searchPageHttp(Environment env) {
        ScraperSettings s = ScraperEvidenceFactory.settings(env);
        if (s.contact() == null || s.contact().isBlank()) {
            // Not a crash: say so and run without this source, the same "not available" outcome as any unconfigured source.
            ScraperEvidenceFactory.logContactMissing("the http certificates provider");
            return null;
        }
        String pageUrl = env.getProperty("cevoc.certificates.search-page.url", SearchPageCertificateSource.DEFAULT_PAGE_URL);
        Duration ttl = Duration.ofSeconds(env.getProperty("cevoc.certificates.cache-ttl-seconds", Long.class, 300L));
        CertificateScraperProperties props = new CertificateScraperProperties(pageUrl, s.userAgent(), s.minInterval(),
                s.connectTimeout(), s.requestTimeout(), ttl, CertificateKeyStrategy.VIA_ENFORCEMENT_SITE);
        // A fresh fetcher per lookup: the session cookie lives in memory for that one lookup only.
        // Browser headers (decision 0024): the bot management in front of the page refuses the identifying agent.
        boolean browserHeaders = env.getProperty("cevoc.certificates.search-page.http-browser-headers", Boolean.class, true);
        return new SearchPageHttpCertificateSource(() -> new PoliteHttpFetcher(props, browserHeaders), pageUrl, new CertificatePageParser(),
                INTRA_DELAY_MAX_MS, ttl, Clock.systemUTC());
    }

    private static CertificateSourcePort httpForm(Environment env) {
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
