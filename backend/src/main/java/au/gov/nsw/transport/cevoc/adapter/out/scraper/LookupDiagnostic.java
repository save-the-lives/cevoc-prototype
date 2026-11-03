package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A short, fixed-vocabulary reason for why one lookup ended UNAVAILABLE, for the owner's live check only. It holds
 * the step name, a whitelisted cause token and coarse yes/no page markers, never page text, never any value the
 * owner typed. Kept in a thread-local for one call (like {@link RequestScopedRegistration}); nothing reads it
 * outside the live-check endpoint.
 */
public final class LookupDiagnostic {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();
    private static final Pattern STEP = Pattern.compile("browser step '([a-z-]{1,20})' failed");
    private static final Pattern NET = Pattern.compile("net::(ERR_[A-Z_]{1,40})");
    private static final Pattern CLASS_ONLY = Pattern.compile("failed: ([A-Za-z]{1,40})$");

    private LookupDiagnostic() {}

    public static void clear() {
        CURRENT.remove();
    }

    public static void set(String reason) {
        CURRENT.set(reason);
    }

    /** Returns the reason recorded on this thread (or null) and forgets it. */
    public static String take() {
        String v = CURRENT.get();
        CURRENT.remove();
        return v;
    }

    /** Maps an exception message from the browser layer onto the fixed vocabulary. */
    public static String fromFailure(String message) {
        String m = message == null ? "" : message.lines().findFirst().orElse("");
        StringBuilder sb = new StringBuilder();
        Matcher step = STEP.matcher(m);
        if (m.startsWith("could not start the browser")) {
            sb.append("step=start");
        } else if (step.find()) {
            sb.append("step=").append(step.group(1));
        } else {
            sb.append("step=unknown");
        }
        sb.append("; cause=");
        Matcher net = NET.matcher(m);
        String lower = m.toLowerCase(Locale.ROOT);
        if (net.find()) {
            sb.append(net.group(1));
        } else if (lower.contains("timeout")) {
            sb.append("timeout");
        } else if (lower.contains("executable doesn't exist") || lower.contains("playwright was just installed")) {
            sb.append("browser-not-installed");
        } else if (lower.contains("no matching button")) {
            sb.append("button-not-found");
        } else if (lower.contains("target page, context or browser has been closed") || lower.contains("browser has been closed")) {
            sb.append("browser-closed");
        } else if (lower.contains("failed to launch") || lower.contains("browsertype.launch")) {
            sb.append("browser-launch-failed");
        } else if (lower.contains("strict mode violation")) {
            sb.append("selector-matches-many");
        } else {
            Matcher c = CLASS_ONLY.matcher(m);
            sb.append(c.find() ? c.group(1) : "other");
        }
        return sb.toString();
    }

    /** Coarse markers of an unreadable page: yes/no flags and a size bucket, no text. */
    public static String fromUnreadablePage(String where, String html) {
        String h = html == null ? "" : html;
        String lower = h.toLowerCase(Locale.ROOT);
        return "page not recognised at " + where + "; html-size=" + bucket(h.length())
                + "; has-pnn-field=" + yn(lower.contains("pnn"))
                + "; has-date-field=" + yn(lower.contains("dateofoffence"))
                + "; has-next-button=" + yn(lower.contains("next"))
                + "; has-penalty-notice-heading=" + yn(lower.contains("penalty notice number"))
                + "; looks-blocked=" + yn(lower.contains("access denied") || lower.contains("captcha")
                        || lower.contains("forbidden") || lower.contains("unusual traffic"));
    }

    private static String bucket(int n) {
        return n == 0 ? "0" : n < 2_000 ? "<2k" : n < 20_000 ? "<20k" : n < 200_000 ? "<200k" : ">=200k";
    }

    private static String yn(boolean b) {
        return b ? "yes" : "no";
    }
}
