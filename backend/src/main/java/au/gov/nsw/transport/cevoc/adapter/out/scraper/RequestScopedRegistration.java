package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * A {@link RegistrationProvider} for the owner's LOCAL live check only. The plate lives in a thread-local for
 * the duration of one call to {@link #with} and is removed in a finally block, so it is never stored, cached or
 * logged. Nothing on the public API sets it; only the loopback-only local-check endpoint (live-browser profile)
 * does. Outside such a call it supplies nothing, so the images step is skipped.
 */
public final class RequestScopedRegistration implements RegistrationProvider {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    /** Runs {@code action} on this thread with {@code registration} visible to this provider, then forgets it. */
    public static <T> T with(String registration, Supplier<T> action) {
        CURRENT.set(registration);
        try {
            return action.get();
        } finally {
            CURRENT.remove();
        }
    }

    @Override
    public Optional<String> registrationFor(PenaltyLookupRequest request) {
        String v = CURRENT.get();
        return v == null || v.isBlank() ? Optional.empty() : Optional.of(v);
    }

    @Override
    public String toString() {
        return "RequestScopedRegistration";
    }
}
