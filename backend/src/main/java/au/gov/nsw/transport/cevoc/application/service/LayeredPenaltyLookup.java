package au.gov.nsw.transport.cevoc.application.service;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.application.port.out.EvidenceSourcePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.util.ArrayList;
import java.util.List;

/**
 * Lookup order: (1) the manifest-backed lookup first; (2) if it answers LIVE_LOOKUP_OFF and a live
 * source is present, ask the live source(s); (3) otherwise the friendly "switched off" result stands.
 * Live sources are null when their switch is off, which is the default everywhere.
 */
public class LayeredPenaltyLookup implements PenaltyLookupPort {

    private final PenaltyLookupPort manifest;
    private final EvidenceSourcePort evidenceSource;
    private final CertificateSourcePort certificateSource;

    public LayeredPenaltyLookup(PenaltyLookupPort manifest, EvidenceSourcePort evidenceSource,
                                CertificateSourcePort certificateSource) {
        this.manifest = manifest;
        this.evidenceSource = evidenceSource;
        this.certificateSource = certificateSource;
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        PenaltyLookupResult first = manifest.find(request);
        if (first.status() != PenaltyLookupResult.Status.LIVE_LOOKUP_OFF
                || (evidenceSource == null && certificateSource == null)) {
            return first;
        }
        List<EvidenceItem> items = new ArrayList<>();
        var found = evidenceSource == null ? java.util.Optional.<EvidenceSourcePort.Found>empty()
                : evidenceSource.fetch(request);
        found.ifPresent(f -> items.addAll(f.evidence()));
        if (certificateSource != null) {
            items.addAll(certificateSource.certificates(request));
        }
        if (found.isEmpty() && items.isEmpty()) {
            return first;
        }
        return new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, request.infringementNumber(),
                "Live lookup result.", found.map(EvidenceSourcePort.Found::notice).orElse(null), items, "LIVE");
    }
}
