package au.gov.nsw.transport.cevoc.application.port.in;

import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;

/** Driving port: what the outside world can ask of the application. */
public interface LookupPenaltyUseCase {
    PenaltyLookupResult lookup(PenaltyLookupRequest request);
}
