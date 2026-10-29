package au.gov.nsw.transport.cevoc.domain;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.util.List;

/**
 * The content we show on our own page. {@code notice} is null unless FOUND. {@code evidence} may be
 * empty (for example officer-issued notices have no camera evidence). {@code source} says where the
 * content came from so the UI can be honest about it (STUB now; a Revenue NSW page or evidence API later).
 * {@code cameraCode} is internal (read from the evidence image banner by the scraper adapter, null otherwise);
 * it is excluded from the JSON response so the public API and the frontend are unchanged.
 */
public record PenaltyLookupResult(
        Status status,
        String infringementNumber,
        String summary,
        NoticeDetails notice,
        List<EvidenceItem> evidence,
        String source,
        @JsonIgnore String cameraCode) {

    /** Without a camera code (all adapters except the evidence scraper). */
    public PenaltyLookupResult(Status status, String infringementNumber, String summary, NoticeDetails notice,
                               List<EvidenceItem> evidence, String source) {
        this(status, infringementNumber, summary, notice, evidence, source, null);
    }

    public enum Status { FOUND, NOT_FOUND, UNAVAILABLE, LIVE_LOOKUP_OFF, LIVE_LOOKUP_DISABLED }
}
