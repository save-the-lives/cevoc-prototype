package cevoc.adapter.out.scraper;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * In-memory holder (single replica) of the few cookies a browser visit to the certificates search page leaves behind: the
 * JSF session and the page's bot-management cookies. Only the allow-listed names are kept, for at most {@link #TTL}; values are
 * never logged. It lets the next lookup try plain HTTP first and fall back to the browser when that fails.
 */
public final class SessionCookies {

    public record Cookie(String name, String value, String domain, String path) {}

    public static final Set<String> ALLOWED = Set.of("jsessionid", "ak_bmsc", "bm_sv");
    public static final Duration TTL = Duration.ofMinutes(15);

    private record Held(Instant at, List<Cookie> cookies) {}

    private volatile Held held;

    /** Keeps the allow-listed cookies of {@code cookies}; nothing is stored unless the JSF session cookie is among them. */
    public void put(List<Cookie> cookies, Instant now) {
        if (cookies == null) return;
        List<Cookie> keep = cookies.stream()
                .filter(c -> c != null && c.name() != null && c.value() != null && !c.value().isBlank()
                        && ALLOWED.contains(c.name().toLowerCase(Locale.ROOT)))
                .toList();
        boolean hasSession = keep.stream().anyMatch(c -> c.name().equalsIgnoreCase("JSESSIONID"));
        held = hasSession ? new Held(now, keep) : null;
    }

    public Optional<List<Cookie>> fresh(Instant now) {
        Held h = held;
        return h != null && h.at().plus(TTL).isAfter(now) ? Optional.of(h.cookies()) : Optional.empty();
    }

    public void clear() {
        held = null;
    }
}
