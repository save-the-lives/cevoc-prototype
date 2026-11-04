package au.gov.nsw.transport.cevoc.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

/**
 * The content we show on our own page. {@code notice} is null unless FOUND. {@code evidence} may be
 * empty (for example officer-issued notices have no camera evidence). {@code source} says where the
 * content came from so the UI can be honest about it (STUB now; a Revenue NSW page or evidence API later).
 * {@code cameraCode} is internal (read from the evidence image banner by the scraper adapter, null otherwise);
 * it is excluded from the JSON response. {@code certificates} is the enforcement-centre certificate list for the camera
 * and offence time, with {@code coversOffence} marking the row(s) valid at the offence (empty when unknown or unavailable);
 * {@code certificatesNote} is an internal status note (for example a degraded lookup) and is not serialised.
 * {@code plateRequired} is true when the source holds camera images for this notice but releases them only once the
 * registration number is given and none was given for this request. It is a yes/no flag: no plate is ever echoed.
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
        boolean plateRequired) {

    public PenaltyLookupResult {
        certificates = certificates == null ? List.of() : List.copyOf(certificates);
    }

    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source, String cameraCode,
                               List<CertificateItem> certificates, String certificatesNote) {
        this(status, infringementNumber, summary, notice, evidence, source, cameraCode, certificates, certificatesNote, false);
    }

    /** A copy with the evidence list replaced (for example linked, or emptied for the early "details" part). */
    public PenaltyLookupResult withEvidence(List<EvidenceItem> items) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, items, source, cameraCode, certificates,
                certificatesNote, plateRequired);
    }

    public PenaltyLookupResult withPlateRequired(boolean required) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, evidence, source, cameraCode, certificates,
                certificatesNote, required);
    }

    /** With a camera code but no certificates yet. */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source, String cameraCode) {
        this(status, infringementNumber, summary, notice, evidence, source, cameraCode, List.of(), null);
    }

    /** Returns a copy carrying the certificate list (covering rows marked) and an internal status note. */
    public PenaltyLookupResult withCertificates(List<CertificateItem> items, String note) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, evidence, source, cameraCode, items, note, plateRequired);
    }

    /** Without a camera code (all adapters except the evidence scraper). */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source) {
        this(status, infringementNumber, summary, notice, evidence, source, null, List.of(), null);
    }

    public enum Status { FOUND, NOT_FOUND, UNAVAILABLE, LIVE_LOOKUP_OFF, LIVE_LOOKUP_DISABLED }
}
