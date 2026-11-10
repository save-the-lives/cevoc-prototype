package cevoc.adapter.in.web;

/**
 * Request-scoped thread-local holding the offending vehicle's plate for the current lookup.
 * Set by the lookup service when evidence is captured; read by {@link MediaController} when serving blurred media.
 * The plate is never logged, stored, or sent to the browser.
 */
public final class OffendingPlateContext {

    private static final ThreadLocal<String> PLATE = new ThreadLocal<>();

    private OffendingPlateContext() {}

    /** Set the offending plate for the current request. */
    public static void set(String plate) {
        PLATE.set(plate);
    }

    /** Get the offending plate for the current request, or null if not set. */
    public static String get() {
        return PLATE.get();
    }

    /** Clear after the request completes. */
    public static void clear() {
        PLATE.remove();
    }
}
