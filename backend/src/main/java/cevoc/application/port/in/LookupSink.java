package cevoc.application.port.in;

import cevoc.domain.CertificateItem;
import cevoc.domain.EvidenceItem;
import cevoc.domain.PenaltyLookupResult;
import java.util.List;

/**
 * Receives the parts of one lookup in order: details, then (for a found notice) evidence, then certificates, then
 * done; or an error with a whitelisted cause token. Called on the lookup thread.
 */
public interface LookupSink {
    /** Status, summary and notice (evidence and certificates empty). A non-FOUND status is followed by done. */
    void details(PenaltyLookupResult details);

    /** Evidence with links, and whether the source wants the registration number before it shows images. */
    void evidence(List<EvidenceItem> evidence, boolean plateRequired);

    void certificates(List<CertificateItem> certificates);

    void done();

    /** A fixed-vocabulary cause token (no values from the request or the page). */
    void error(String cause);
}
