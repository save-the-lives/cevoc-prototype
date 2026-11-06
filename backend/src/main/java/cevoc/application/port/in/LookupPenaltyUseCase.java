package cevoc.application.port.in;

import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;

/** Driving port: what the outside world can ask of the application. */
public interface LookupPenaltyUseCase {
    PenaltyLookupResult lookup(PenaltyLookupRequest request);

    /** The same lookup delivered in parts, in one call (one browser session), see {@link LookupSink}. */
    default void lookup(PenaltyLookupRequest request, LookupSink sink) {
        PenaltyLookupResult r = lookup(request);
        sink.details(r.withEvidence(java.util.List.of()));
        if (r.status() == PenaltyLookupResult.Status.FOUND) {
            sink.evidence(r.evidence(), r.plateRequired());
            sink.certificates(r.certificates(), r.certificateCoverage());
        }
        sink.done();
    }
}
