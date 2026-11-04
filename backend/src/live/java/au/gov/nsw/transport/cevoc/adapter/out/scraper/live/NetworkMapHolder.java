package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import java.util.List;

/**
 * Hand-over for the network map of ONE live-check call, on the calling thread (like RequestScopedRegistration):
 * the controller calls {@link #request()} before the lookup; the browser session sees it when it opens and, on
 * close, deposits the redacted lines; the controller takes them afterwards. Off unless requested, and cleared at
 * the end of the call.
 */
public final class NetworkMapHolder {

    private static final ThreadLocal<Boolean> WANTED = new ThreadLocal<>();
    private static final ThreadLocal<List<String>> LINES = new ThreadLocal<>();

    private NetworkMapHolder() {}

    public static void request() {
        WANTED.set(Boolean.TRUE);
        LINES.remove();
    }

    static boolean wanted() {
        return Boolean.TRUE.equals(WANTED.get());
    }

    static void deposit(List<String> lines) {
        LINES.set(lines);
    }

    /** Returns the deposited lines (or an empty list) and clears everything for this thread. */
    public static List<String> take() {
        List<String> l = LINES.get();
        WANTED.remove();
        LINES.remove();
        return l == null ? List.of() : l;
    }
}
