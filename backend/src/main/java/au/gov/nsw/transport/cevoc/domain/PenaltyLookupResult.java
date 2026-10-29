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
        @JsonIgnore String certificatesNote) {

    public PenaltyLookupResult {
        certificates = certificates == null ? List.of() : List.copyOf(certificates);
    }

    /** With a camera code but no certificates yet. */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source, String cameraCode) {
        this(status, infringementNumber, summary, notice, evidence, source, cameraCode, List.of(), null);
    }

    /** Returns a copy carrying the certificate list (covering rows marked) and an internal status note. */
    public PenaltyLookupResult withCertificates(List<CertificateItem> items, String note) {
        return new PenaltyLookupResult(status, infringementNumber, summary, notice, evidence, source, cameraCode, items, note);
    }

    /** Without a camera code (all adapters except the evidence scraper). */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source) {
        this(status, infringementNumber, summary, notice, evidence, source, null, List.of(), null);
    }

    public enum Status { FOUND, NOT_FOUND, UNAVAILABLE, LIVE_LOOKUP_OFF, LIVE_LOOKUP_DISABLED }
}
