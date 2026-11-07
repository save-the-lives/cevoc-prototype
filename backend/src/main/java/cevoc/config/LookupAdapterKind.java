package cevoc.config;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The one adapter-selection setting for the penalty/evidence lookup: {@code cevoc.penalty-lookup.adapter}
 * (env CEVOC_PENALTY_LOOKUP_ADAPTER). Every lookup route is just another adapter behind the same port; this picks which.
 * <ul>
 *   <li>{@code browser}: the default (also what an empty or unset value means). The Chromium route to the Revenue NSW page
 *       (temporary: delete at cutover; needs the live-browser build, which the Docker image always has). It does nothing, and
 *       says so, until {@code cevoc.scraper.evidence.contact} is set.</li>
 *   <li>{@code stub}: an explicit choice only. Bundled fictitious manifest data, no network, no browser.</li>
 *   <li>{@code http}: the plain HTTP route to the Revenue NSW JSON service (interim: removed when the TfNSW API exists).</li>
 *   <li>{@code adaptive}: circuit breaker. Tries the plain HTTP route first and falls back to the Chromium route
 *       on failure. After 3 failures within 5 minutes the breaker opens and goes straight to Chromium for 10 minutes.</li>
 *   <li>{@code api}: the direct API route. Reserved; not built yet, so selecting it stops start-up with a clear message.</li>
 * </ul>
 * Any other value (including the retired names {@code manifest}, {@code scraper-evidence} and {@code revenue-nsw-http}) is
 * not an alias of anything: it is treated as the safe choice, {@code stub} (nothing is contacted), and logged as a warning.
 */
public enum LookupAdapterKind {
    STUB, BROWSER, HTTP, ADAPTIVE, API;

    public static final String PROPERTY = "cevoc.penalty-lookup.adapter";
    private static final Logger LOG = LoggerFactory.getLogger(LookupAdapterKind.class);

    /**
     * True when the lookup route keeps real image bytes (browser, http), so the media default is the in-memory adapter.
     * Quiet (no warning): used from property expressions. An unknown value counts as stub, like {@link #of}.
     * Also returns true when the new {@code cevoc.evidence.providers} list contains browser or http.
     */
    public static boolean keepsImageBytes(String raw) {
        String v = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return v.isEmpty() || v.equals("browser") || v.equals("http") || v.equals("adaptive");
    }

    /**
     * True when the evidence providers list (comma-separated) contains a provider that keeps real image bytes.
     * Called from property expressions for {@code cevoc.evidence.providers}.
     */
    public static boolean evidenceProvidersKeepImageBytes(String raw) {
        if (raw == null || raw.isBlank()) return false;
        for (String part : raw.split(",")) {
            String id = part.trim().toLowerCase(Locale.ROOT);
            if (id.equals("browser") || id.equals("http") || id.equals("adaptive")) return true;
        }
        return false;
    }

    public static LookupAdapterKind of(String raw) {
        String v = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return switch (v) {
            case "", "browser" -> BROWSER;
            case "stub" -> STUB;
            case "http" -> HTTP;
            case "adaptive" -> ADAPTIVE;
            case "api" -> API;
            default -> {
                LOG.warn("{} has a value that is not a known adapter (known: stub, browser, http, adaptive, api); using stub (nothing is contacted)", PROPERTY);
                yield STUB;
            }
        };
    }
}
