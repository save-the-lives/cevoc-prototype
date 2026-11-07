package cevoc.config;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;

/**
 * Builds the evidence provider list from {@code cevoc.evidence.providers} (env {@code CEVOC_EVIDENCE_PROVIDERS}):
 * an ordered, comma-separated list of provider names tried left to right, same names as the single-value
 * {@code cevoc.penalty-lookup.adapter} setting:
 * <ul>
 *   <li>{@code http}: the plain HTTP route to the Revenue NSW JSON service;</li>
 *   <li>{@code browser}: the Chromium route to the Revenue NSW page (temporary; needs the live-browser build);</li>
 *   <li>{@code stub}: bundled fictitious data, nothing contacted;</li>
 *   <li>{@code api}: reserved; not available yet, selecting it stops start-up.</li>
 * </ul>
 * <p>When {@code cevoc.evidence.providers} is set, it takes precedence over {@code cevoc.penalty-lookup.adapter}.
 * A single value like {@code browser} selects just that adapter (backward compatible with the old setting).
 * The value {@code http,browser} activates the adaptive (circuit-breaker) adapter: try HTTP first, fall to browser.
 * <p>When unset or empty, the legacy {@code cevoc.penalty-lookup.adapter} is used instead (full backward compatibility).
 */
public final class EvidenceProviders {

    public static final String PROPERTY = "cevoc.evidence.providers";
    public static final String BROWSER = "browser";
    public static final String HTTP = "http";
    public static final String STUB = "stub";
    public static final String API = "api";
    public static final String ADAPTIVE = "adaptive";

    private static final Logger LOG = LoggerFactory.getLogger(EvidenceProviders.class);
    private static final Set<String> KNOWN = Set.of(BROWSER, HTTP, STUB, API, ADAPTIVE);

    private EvidenceProviders() {}

    /**
     * The provider ids to use, in order. When {@code cevoc.evidence.providers} is set, it is parsed as a
     * comma-separated list. When unset or empty, the legacy {@code cevoc.penalty-lookup.adapter} is read instead
     * and returned as a single-element list.
     *
     * @return the provider ids and whether the new property was used (true) or the legacy one (false)
     */
    public static Result resolve(Environment env) {
        String raw = env.getProperty(PROPERTY, "").trim();
        if (!raw.isEmpty()) {
            List<String> ids = parse(raw);
            if (!ids.isEmpty()) {
                LOG.info("Evidence providers ({}): {}", PROPERTY, ids);
                return new Result(ids, true);
            }
            // Non-empty but nothing known: fall through to legacy.
            LOG.warn("{} lists no known provider; falling back to {}", PROPERTY, LookupAdapterKind.PROPERTY);
        }

        // Legacy: read the single adapter setting.
        LookupAdapterKind kind = LookupAdapterKind.of(env.getProperty(LookupAdapterKind.PROPERTY, ""));
        String id = switch (kind) {
            case STUB -> STUB;
            case BROWSER -> BROWSER;
            case HTTP -> HTTP;
            case ADAPTIVE -> ADAPTIVE;
            case API -> API;
        };
        LOG.info("Evidence providers (legacy {}={}): [{}]", LookupAdapterKind.PROPERTY, kind.name().toLowerCase(Locale.ROOT), id);
        return new Result(List.of(id), false);
    }

    private static List<String> parse(String raw) {
        List<String> out = new ArrayList<>();
        for (String part : raw.split(",")) {
            String id = part.trim().toLowerCase(Locale.ROOT);
            if (id.isEmpty() || out.contains(id)) continue;
            if (KNOWN.contains(id)) {
                out.add(id);
            } else {
                LOG.warn("evidence provider '{}' is not a known name and is ignored (known: http, browser, stub, api, adaptive)", id);
            }
        }
        return out;
    }

    /** The resolved provider list and which property it came from. */
    public record Result(List<String> ids, boolean fromNewProperty) {}
}
