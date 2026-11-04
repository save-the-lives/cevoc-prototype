package au.gov.nsw.transport.cevoc.domain;

import java.util.function.Supplier;

/**
 * Holds a vehicle registration for the duration of one call on the current thread, then forgets it. It is never
 * stored, cached or logged. The public endpoint and the local live check set it; only the evidence scraper (off by
 * default) reads it, through its RegistrationProvider.
 */
public final class RegistrationScope {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private RegistrationScope() {}

    public static <T> T with(String registration, Supplier<T> action) {
        CURRENT.set(registration);
        try {
            return action.get();
        } finally {
            CURRENT.remove();
        }
    }

    /** The registration for this call, or null. */
    public static String current() {
        return CURRENT.get();
    }
}
