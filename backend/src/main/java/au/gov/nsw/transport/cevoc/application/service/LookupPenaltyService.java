package au.gov.nsw.transport.cevoc.application.service;

import au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.time.Duration;
import java.util.List;

public class LookupPenaltyService implements LookupPenaltyUseCase {

    static final Duration LINK_VALIDITY = Duration.ofMinutes(5);

    private final PenaltyLookupPort penaltyLookup;
    private final SignedLinkPort signedLinks;

    public LookupPenaltyService(PenaltyLookupPort penaltyLookup, SignedLinkPort signedLinks) {
        this.penaltyLookup = penaltyLookup;
        this.signedLinks = signedLinks;
    }

    @Override
    public PenaltyLookupResult lookup(PenaltyLookupRequest request) {
        try {
            PenaltyLookupResult r = penaltyLookup.find(request);
            if (r.evidence() == null || r.evidence().isEmpty()) {
                return r;
            }
            List<EvidenceItem> linked = r.evidence().stream()
                    .map(e -> e.withUrl(signedLinks.linkFor(e.url(), LINK_VALIDITY).url()))
                    .toList();
            return new PenaltyLookupResult(r.status(), r.infringementNumber(), r.summary(), r.notice(), linked, r.source());
        } catch (RuntimeException e) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.UNAVAILABLE,
                    request.infringementNumber(), "We could not load this right now. Please try again.",
                    null, List.of(), "ERROR");
        }
    }
}
