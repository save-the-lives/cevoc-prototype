package au.gov.nsw.transport.cevoc.adapter.out;

import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.util.List;

/**
 * Lookup order: manifest first, then the live source. A manifest hit is returned as is. On a miss,
 * numbers starting with X still report NOT_FOUND; anything else goes to the live adapter only when
 * live lookup is enabled, otherwise LIVE_LOOKUP_DISABLED (distinct from NOT_FOUND).
 */
public class ManifestFirstPenaltyLookupAdapter implements PenaltyLookupPort {

    public static final String DISABLED_MESSAGE =
            "Live lookup against the source sites is switched off until approvals are in place.";

    private final PenaltyLookupPort manifest;
    private final PenaltyLookupPort live; // may be null: no live adapter built yet
    private final boolean liveEnabled;

    public ManifestFirstPenaltyLookupAdapter(PenaltyLookupPort manifest, PenaltyLookupPort live, boolean liveEnabled) {
        this.manifest = manifest;
        this.live = live;
        this.liveEnabled = liveEnabled;
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        PenaltyLookupResult fromManifest = manifest.find(request);
        if (fromManifest.status() != PenaltyLookupResult.Status.NOT_FOUND) {
            return fromManifest;
        }
        String n = request.infringementNumber();
        if (n.toUpperCase().startsWith("X")) {
            return fromManifest;
        }
        if (!liveEnabled) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.LIVE_LOOKUP_DISABLED, n,
                    DISABLED_MESSAGE, null, List.of(), fromManifest.source());
        }
        if (live == null) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.UNAVAILABLE, n,
                    "Live lookup is enabled but no live source adapter is configured.", null, List.of(), "ERROR");
        }
        return live.find(request);
    }
}
