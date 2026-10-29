package au.gov.nsw.transport.cevoc.domain;

import java.util.List;

/**
 * The content we show on our own page. {@code notice} is null unless FOUND. {@code evidence} may be
 * empty (for example officer-issued notices have no camera evidence). {@code source} says where the
 * content came from so the UI can be honest about it (STUB now; a Revenue NSW page or evidence API later).
 */
public record PenaltyLookupResult(
        Status status,
        String infringementNumber,
        String summary,
        NoticeDetails notice,
        List<EvidenceItem> evidence,
        String source) {

    public enum Status { FOUND, NOT_FOUND, UNAVAILABLE }
}
