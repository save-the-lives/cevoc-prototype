package cevoc.domain;

import java.util.function.Supplier;

/**
 * Holds the family name and given names for the duration of one call, then forgets them.
 * Some notice types (e.g. seatbelt) require these before the myPenalty site shows evidence.
 * Never stored, cached or logged. The evidence scraper reads them when the login page
 * has the identity fields enabled.
 */
public final class IdentityScope {

    public record Identity(String familyName, String givenNames) {}

    private static final ThreadLocal<Identity> CURRENT = new ThreadLocal<>();

    private IdentityScope() {}

    public static <T> T with(Identity identity, Supplier<T> action) {
        CURRENT.set(identity);
        try {
            return action.get();
        } finally {
            CURRENT.remove();
        }
    }

    /** The identity for this call, or null. */
    public static Identity current() {
        return CURRENT.get();
    }
}
