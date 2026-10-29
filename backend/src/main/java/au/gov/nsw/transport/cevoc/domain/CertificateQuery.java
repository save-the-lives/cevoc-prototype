package au.gov.nsw.transport.cevoc.domain;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;

/**
 * What we ask a certificate source. The real page (searchCertificates.jsf) is keyed by an enforcement
 * site location code plus a date/time range, NOT by penalty number, so the normal query is
 * {@code locationCode} + {@code from} + {@code to} (minute precision, as the page's dd/MM/yyyy HH:mm fields).
 * {@code penaltyNumber} is optional and only used by the legacy BY_PENALTY strategy, which the real page does not support.
 */
public record CertificateQuery(String penaltyNumber, String locationCode, LocalDateTime from, LocalDateTime to) {

    public CertificateQuery {
        if (from != null && to != null && from.isAfter(to)) {
            throw new IllegalArgumentException("from must not be after to");
        }
    }

    /** Legacy: penalty number only (BY_PENALTY, unsupported by the real page). */
    public static CertificateQuery ofPenalty(String penaltyNumber) {
        return new CertificateQuery(penaltyNumber, null, null, null);
    }

    /** Location code and an explicit window. */
    public static CertificateQuery ofLocation(String locationCode, LocalDateTime from, LocalDateTime to) {
        return new CertificateQuery(null, locationCode, from, to);
    }

    /**
     * Window around an offence. A null margin (the default) means the whole offence day, 00:00 to 23:59;
     * otherwise offence date/time minus and plus the margin.
     */
    public static CertificateQuery aroundOffence(String locationCode, LocalDate offenceDate, LocalTime offenceTime, Duration margin) {
        if (margin == null) {
            return ofLocation(locationCode, offenceDate.atStartOfDay(), offenceDate.atTime(23, 59));
        }
        LocalDateTime at = offenceDate.atTime(offenceTime).truncatedTo(ChronoUnit.MINUTES);
        return ofLocation(locationCode, at.minus(margin), at.plus(margin));
    }
}
