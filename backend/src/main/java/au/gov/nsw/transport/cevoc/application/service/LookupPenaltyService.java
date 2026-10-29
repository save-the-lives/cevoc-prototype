package au.gov.nsw.transport.cevoc.application.service;

import au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;

public class LookupPenaltyService implements LookupPenaltyUseCase {

    private final PenaltyLookupPort penaltyLookup;

    public LookupPenaltyService(PenaltyLookupPort penaltyLookup) {
        this.penaltyLookup = penaltyLookup;
    }

    @Override
    public PenaltyLookupResult lookup(PenaltyLookupRequest request) {
        try {
            return penaltyLookup.find(request);
        } catch (RuntimeException e) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.UNAVAILABLE,
                    request.infringementNumber(), "We could not load this right now. Please try again.",
                    null, java.util.List.of(), "ERROR");
        }
    }
}
