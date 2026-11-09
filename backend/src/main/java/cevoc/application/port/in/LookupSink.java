package cevoc.application.port.in;

import cevoc.domain.CertificateAssessment;
import cevoc.domain.CertificateCoverage;
import cevoc.domain.CertificateItem;
import cevoc.domain.EvidenceItem;
import cevoc.domain.PenaltyLookupResult;
import java.util.List;
import java.util.Map;

/**
 * Receives the parts of one lookup in order: details, then (for a found notice) evidence, then certificates, then
 * done; or an error with a whitelisted cause token. Called on the lookup thread.
 */
public interface LookupSink {
    /** Status, summary and notice (evidence and certificates empty). A non-FOUND status is followed by done. */
    void details(PenaltyLookupResult details);

    /** Evidence with links, and whether the source wants the registration number before it shows images. */
    void evidence(List<EvidenceItem> evidence, boolean plateRequired);

    /**
     * The flexible details map (lane, direction, time since red and so on; decision record 0009). Only called when the
     * route returned any. Held in memory for the request; never logged. Default: ignored.
     */
    default void extra(Map<String, Object> details) {}

    void certificates(List<CertificateItem> certificates);

    /**
     * The filtered certificate list with the coverage summary (covered, gap or none). {@code coverage} is null when the
     * certificate step did not run. Default: just the list.
     */
    default void certificates(List<CertificateItem> certificates, CertificateCoverage coverage) {
        certificates(certificates);
    }

    /** With uncovered types from the per-type assessment. Default: delegates without them. */
    default void certificates(List<CertificateItem> certificates, CertificateCoverage coverage,
                              List<CertificateAssessment.UncoveredType> uncoveredTypes) {
        certificates(certificates, coverage);
    }


    void done();

    /** A fixed-vocabulary cause token (no values from the request or the page). */
    void error(String cause);
}
