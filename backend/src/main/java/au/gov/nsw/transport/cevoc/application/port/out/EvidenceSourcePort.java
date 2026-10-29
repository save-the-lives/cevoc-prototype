package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import java.util.List;
import java.util.Optional;

/**
 * Driven port: a live source of notice details and camera images/videos for numbers that are not in the
 * committed manifest. Optional: with no adapter present (the default everywhere) the layered lookup
 * simply reports that live lookup is switched off. An adapter must only be created when
 * cevoc.evidence.scraper.enabled=true (env CEVOC_EVIDENCE_SCRAPER_ENABLED) and approval has been obtained.
 * Media bytes are buffered into the media storage port, never proxied on each view.
 */
public interface EvidenceSourcePort {
    Optional<Found> fetch(PenaltyLookupRequest request);

    record Found(NoticeDetails notice, List<EvidenceItem> evidence) { }
}
