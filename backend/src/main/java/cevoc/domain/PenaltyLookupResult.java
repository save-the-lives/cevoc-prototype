package cevoc.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

/**
 * The content we show on our own page. {@code notice} is null unless FOUND. {@code evidence} may be
 * empty (for example officer-issued notices have no camera evidence). {@code source} says where the
 * content came from so the UI can be honest about it (STUB now; a Revenue NSW page or evidence API later).
 * {@code cameraCode} is internal (read from the evidence image banner by the scraper adapter, null otherwise);
 * it is excluded from the JSON response. {@code certificates} is the enforcement-centre certificate list for the camera
 * and offence time, with {@code coversOffence} marking the row(s) valid at the offence (empty when unknown or unavailable);
 * {@code certificateCoverage} is the plain answer (covered, gap or none, with the gap in days) for the filtered list; null when
 * the certificate step did not run or failed.
 * {@code certificatesNote} is an internal status note (for example a degraded lookup) and is not serialised.
 * {@code plateRequired} is true when the source holds camera images for this notice but releases them only once the
 * registration number is given and none was given for this request. It is a yes/no flag: no plate is ever echoed.
 * {@code details} is the flexible map of every other field a route returned (for example lane, direction, time since red),
 * keyed by a stable name (decision record 0009). Empty means nothing was returned and it is then not serialised. It is held
 * in memory for the request only and is never logged; it never holds the registration number.
 */
public record PenaltyLookupResult(
        Status status,
        String infringementNumber,
        String summary,
        NoticeDetails notice,
        List<EvidenceItem> evidence,
        String source,
        @JsonIgnore String cameraCode,
        List<CertificateItem> certificates,
        @JsonIgnore String certificatesNote,
        boolean plateRequired,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) Map<String, Object> details,
        @JsonInclude(JsonInclude.Include.NON_NULL) CertificateCoverage certificateCoverage,
        @JsonInclude(JsonInclude.Include.NON_EMPTY) List<CertificateAssessment.UncoveredType> uncoveredTypes) {

    public PenaltyLookupResult {
        certificates = certificates == null ? List.of() : List.copyOf(certificates);
        details = details == null ? Map.of() : Map.copyOf(details);
        uncoveredTypes = uncoveredTypes == null ? List.of() : List.copyOf(uncoveredTypes);
    }

    /** Without a coverage summary. */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source, String cameraCode,
                               List<CertificateItem> certificates, String certificatesNote, boolean plateRequired,
                               Map<String, Object> details) {
        this(status, infringementNumber, summary, notice, evidence, source, cameraCode, certificates, certificatesNote,
                plateRequired, details, null, List.of());
    }

    /** Without details (the common case until a route fills the map). */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source, String cameraCode,
                               List<CertificateItem> certificates, String certificatesNote, boolean plateRequired) {
        this(status, infringementNumber, summary, notice, evidence, source, cameraCode, certificates, certificatesNote,
                plateRequired, Map.of());
    }

    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source, String cameraCode,
                               List<CertificateItem> certificates, String certificatesNote) {
        this(status, infringementNumber, summary, notice, evidence, source, cameraCode, certificates, certificatesNote, false);
    }

    /** A copy with the evidence list replaced (for example linked, or emptied for the early "details" part). */
    public PenaltyLookupResult withEvidence(List<EvidenceItem> items) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, items, source, cameraCode, certificates,
                certificatesNote, plateRequired, details, certificateCoverage, uncoveredTypes);
    }

    public PenaltyLookupResult withPlateRequired(boolean required) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, evidence, source, cameraCode, certificates,
                certificatesNote, required, details, certificateCoverage, uncoveredTypes);
    }

    /** A copy carrying the flexible details map (null or empty clears it). */
    public PenaltyLookupResult withDetails(Map<String, Object> extra) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, evidence, source, cameraCode, certificates,
                certificatesNote, plateRequired, extra, certificateCoverage, uncoveredTypes);
    }

    /** With a camera code but no certificates yet. */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source, String cameraCode) {
        this(status, infringementNumber, summary, notice, evidence, source, cameraCode, List.of(), null);
    }

    /** Returns a copy carrying the certificate list (covering rows marked) and an internal status note. */
    public PenaltyLookupResult withCertificates(List<CertificateItem> items, String note) {
        return withCertificates(items, null, List.of(), note);
    }

    /** As above, with the coverage summary for the (already filtered) list. */
    public PenaltyLookupResult withCertificates(List<CertificateItem> items, CertificateCoverage coverage, String note) {
        return withCertificates(items, coverage, List.of(), note);
    }

    /** Full version with uncovered types from the per-type assessment. */
    public PenaltyLookupResult withCertificates(List<CertificateItem> items, CertificateCoverage coverage,
                                                List<CertificateAssessment.UncoveredType> uncovered, String note) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, evidence, source, cameraCode, items, note,
                plateRequired, details, coverage, uncovered);
    }

    /** Without a camera code (all adapters except the evidence scraper). */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source) {
        this(status, infringementNumber, summary, notice, evidence, source, null, List.of(), null);
    }

    public enum Status { FOUND, NOT_FOUND, UNAVAILABLE, LIVE_LOOKUP_OFF, LIVE_LOOKUP_DISABLED }
}
