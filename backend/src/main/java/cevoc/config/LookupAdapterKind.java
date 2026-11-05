package cevoc.config;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The one adapter-selection setting for the penalty/evidence lookup: {@code cevoc.penalty-lookup.adapter}
 * (env CEVOC_PENALTY_LOOKUP_ADAPTER). Every lookup route is just another adapter behind the same port; this picks which.
 * <ul>
 *   <li>{@code stub}: the default. Bundled fictitious manifest data only, no network, no browser. Also what an empty or unset value means.</li>
 *   <li>{@code browser}: the Chromium route to the Revenue NSW page (prototype only; needs the live-browser build).</li>
 *   <li>{@code http}: the plain HTTP route to the Revenue NSW JSON service (prototype only).</li>
 *   <li>{@code api}: the direct API route. Reserved; not built yet, so selecting it stops start-up with a clear message.</li>
 * </ul>
 * Any other value (including the retired names {@code manifest}, {@code scraper-evidence} and {@code revenue-nsw-http}) is
 * not an alias of anything: it is treated as the safe default, {@code stub}, and logged as a warning.
 */
public enum LookupAdapterKind {
    STUB, BROWSER, HTTP, API;

    public static final String PROPERTY = "cevoc.penalty-lookup.adapter";
    private static final Logger LOG = LoggerFactory.getLogger(LookupAdapterKind.class);

    public static LookupAdapterKind of(String raw) {
        String v = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        return switch (v) {
            case "", "stub" -> STUB;
            case "browser" -> BROWSER;
            case "http" -> HTTP;
            case "api" -> API;
            default -> {
                LOG.warn("{} has a value that is not a known adapter (known: stub, browser, http, api); using the default, stub", PROPERTY);
                yield STUB;
            }
        };
    }
}
