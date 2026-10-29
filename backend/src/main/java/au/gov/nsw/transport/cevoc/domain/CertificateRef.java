package au.gov.nsw.transport.cevoc.domain;

import java.time.LocalDateTime;

/**
 * One row of the certificates results table (columns: Certificate Description, Certificate type, Period,
 * Certified date, Expiry date). Any field may be null when the page value was missing or unparseable.
 * A date shown without a time is held as 00:00, except the end of {@code Period}, which is held as the end
 * of that day so that a date-only period covers the whole last day.
 *
 * @param periodText  the Period cell exactly as shown (kept for diagnostics)
 * @param periodFrom  start of the validity window, inclusive
 * @param periodTo    end of the validity window, inclusive
 * @param documentRef an href found in the row, or null. The real table shows no download link and the deep link
 *                    carries a signed parameter, so this is never constructed, only copied from the page.
 */
public record CertificateRef(String description, String type, String periodText, LocalDateTime periodFrom,
                             LocalDateTime periodTo, LocalDateTime certifiedDate, LocalDateTime expiryDate,
                             String documentRef) {

    /** True only when the Period window is known and contains {@code at} (both ends inclusive). */
    public boolean covers(LocalDateTime at) {
        return at != null && periodFrom != null && periodTo != null
                && !at.isBefore(periodFrom) && !at.isAfter(periodTo);
    }
}
