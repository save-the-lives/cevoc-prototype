package au.gov.nsw.transport.cevoc.adapter.out.stub;

import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.util.List;

/** Fictitious data so the customer journey can be used before real sources are wired in. */
public class StubPenaltyLookupAdapter implements PenaltyLookupPort {

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        if (request.infringementNumber().toUpperCase().startsWith("X")) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.NOT_FOUND, request.infringementNumber(),
                    "We could not match that notice number and offence date.", List.of(), "STUB");
        }
        return new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, request.infringementNumber(),
                "Sample notice for " + request.offenceDate() + ". Prototype data only.",
                List.of(new EvidenceItem(EvidenceItem.Kind.IMAGE, "Sample image", "/samples/image-1.jpg"),
                        new EvidenceItem(EvidenceItem.Kind.CERTIFICATE, "Sample camera certificate", "/samples/cert-1.pdf")),
                "STUB");
    }
}
