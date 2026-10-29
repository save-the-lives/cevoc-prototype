package au.gov.nsw.transport.cevoc.domain;

import java.util.List;

/**
 * The content we show on our own page. {@code source} says where it came from so the UI can be
 * honest about it (for example STUB now, a Revenue NSW page or an evidence API later).
 */
public record PenaltyLookupResult(
        Status status,
        String infringementNumber,
        String summary,
        List<EvidenceItem> evidence,
        String source) {

    public enum Status { FOUND, NOT_FOUND, UNAVAILABLE }
}
