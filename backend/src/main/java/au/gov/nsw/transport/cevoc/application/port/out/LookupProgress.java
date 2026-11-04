package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.util.List;

/**
 * Optional callbacks an adapter may fire while one lookup is still running, so the page can show the notice details
 * before the images are ready. They run on the lookup thread. Evidence items still hold object keys (the service
 * turns them into links). Nothing here carries the registration number.
 */
public interface LookupProgress {

    LookupProgress NONE = new LookupProgress() { };

    /** The notice details are known (no evidence yet). */
    default void details(PenaltyLookupResult partial) { }

    /** The images have been captured and stored. */
    default void evidence(List<EvidenceItem> items, boolean plateRequired) { }
}
