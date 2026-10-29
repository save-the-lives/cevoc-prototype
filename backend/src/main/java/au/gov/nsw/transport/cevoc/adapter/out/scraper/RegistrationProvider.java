package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import java.util.Optional;

/**
 * Supplies the vehicle registration for the "View images" step, for one request only. The value must be
 * used for that request and then dropped: never stored, cached, logged, or put in the repo or test fixtures.
 * Nothing is wired yet (see {@link #none()}), so the images step is skipped until the owner decides how
 * the motorist's plate reaches the adapter.
 */
@FunctionalInterface
public interface RegistrationProvider {

    Optional<String> registrationFor(PenaltyLookupRequest request);

    static RegistrationProvider none() {
        return request -> Optional.empty();
    }
}
