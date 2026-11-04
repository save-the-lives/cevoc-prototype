package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;

/**
 * Driven port: how we obtain penalty content. Today a stub; later a Revenue NSW pass-through
 * and/or the image, video and certificate APIs (with caching or buffering) as separate adapters.
 */
public interface PenaltyLookupPort {
    PenaltyLookupResult find(PenaltyLookupRequest request);

    /** Same lookup, firing {@code progress} callbacks as parts become known. Adapters that cannot just answer at the end. */
    default PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
        return find(request);
    }
}
