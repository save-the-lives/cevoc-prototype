package au.gov.nsw.transport.cevoc.domain;

import java.time.LocalDateTime;

/**
 * Public API shape of one certificate row in the lookup response. Dates are ISO yyyy-MM-dd strings (or null).
 * Deliberately carries no camera code, plate or link.
 */
public record CertificateItem(String description, String type, String periodText, String certifiedDate,
                              String expiryDate, boolean coversOffence) {

    public static CertificateItem from(CertificateMatch m) {
        CertificateRef c = m.certificate();
        return new CertificateItem(c.description(), c.type(), c.periodText(), day(c.certifiedDate()),
                day(c.expiryDate()), m.covering());
    }

    private static String day(LocalDateTime t) {
        return t == null ? null : t.toLocalDate().toString();
    }
}
