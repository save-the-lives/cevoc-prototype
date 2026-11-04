package cevoc.application.port.out;

import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;

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
