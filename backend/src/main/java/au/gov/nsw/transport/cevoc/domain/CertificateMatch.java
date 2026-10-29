package au.gov.nsw.transport.cevoc.domain;

import java.time.LocalDateTime;
import java.util.List;

/** A certificate row plus whether its Period covers the offence date/time. */
public record CertificateMatch(CertificateRef certificate, boolean covering) {

    /** Returns every row, in page order, with the covering ones marked. Nothing is dropped. */
    public static List<CertificateMatch> mark(List<CertificateRef> all, LocalDateTime offenceAt) {
        return all.stream().map(c -> new CertificateMatch(c, c.covers(offenceAt))).toList();
    }
}
