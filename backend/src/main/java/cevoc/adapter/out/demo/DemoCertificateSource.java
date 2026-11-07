package cevoc.adapter.out.demo;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Sample certificates for the demo cases, behind the same {@link CertificateSourcePort} as the real certificate providers
 * (browser, http, api), so step 8 of the lookup runs through the real service for a demo case. It exists only while demo data
 * is on (it is a bean of {@code DemoDataConfig}) and it makes no network call: the real certificates host is not needed.
 * <p>
 * Keyed like the real page, by camera code and date range. Only the invented demo camera codes ({@link DemoCameras}) are
 * answered here; any other code is not a demo camera and gets an empty list (in practice {@link DemoFirstCertificateSource}
 * hands those on to the configured provider before this is asked). The outcome follows the camera: three rows with one in
 * force, a single row in force, rows none of which is in force, no rows, a simulated failure, or multi-type scenarios
 * (all types covered, one uncovered, mixed) whose rows carry realistic "YEARLY" period text like the real certificate page.
 * Every row is fictitious sample data.
 */
public final class DemoCertificateSource implements CertificateSourcePort {

    private static final String ACCURACY_DESC = "Fictitious speed/red light camera - accuracy test certificate";
    private static final String CALIBRATION_DESC = "Fictitious speed/red light camera - calibration certificate";
    private static final String MAINTENANCE_DESC = "Fictitious speed/red light camera - maintenance certificate";

    /** True when the code is one of the invented demo camera codes. */
    public boolean handles(String cameraCode) {
        return DemoCameras.parse(cameraCode).isPresent();
    }

    @Override
    public List<CertificateRef> findCertificates(CertificateQuery query) {
        DemoCameras.Camera camera = DemoCameras.parse(query == null ? null : query.locationCode()).orElse(null);
        if (camera == null || query.from() == null || query.to() == null) {
            return List.of();
        }
        // The offence day: the middle of the window (the window is the whole offence day, or the offence time plus and minus a margin).
        LocalDate d = query.from().plus(Duration.between(query.from(), query.to()).dividedBy(2)).toLocalDate();
        String what = "Fictitious " + (camera.redLight() ? "red light" : "default block") + " camera certificate";
        List<CertificateRef> rows = new ArrayList<>();
        switch (camera.certs()) {
            case COVERING -> {
                rows.add(yearly(what + " (superseded)", d.minusYears(3), d.minusYears(1).minusDays(1)));
                rows.add(yearly(what + " (current)", d.minusYears(1), d.plusYears(1)));
                rows.add(yearly(what + " (next year)", d.plusYears(1).plusDays(1), d.plusYears(3)));
            }
            case SINGLE -> rows.add(yearly(what, d.minusYears(1), d.plusYears(1)));
            case NOT_COVERING -> {
                rows.add(yearly(what + " (expired before the offence)", d.minusYears(3), d.minusDays(40)));
                rows.add(yearly(what + " (starts after the offence)", d.plusDays(40), d.plusYears(2)));
            }
            case NONE -> { }
            case FAILED -> throw new IllegalStateException("demo certificate source: timeout (simulated failure)");
            case ALL_TYPES_COVERED -> {
                // Two types, both covering the offence date
                rows.add(yearly(ACCURACY_DESC, d.minusYears(1), d.plusYears(1)));
                rows.add(yearly(CALIBRATION_DESC, d.minusMonths(6), d.plusMonths(6)));
            }
            case ONE_TYPE_UNCOVERED -> {
                // Two types: accuracy covers, calibration does not
                rows.add(yearly(ACCURACY_DESC, d.minusYears(1), d.plusYears(1)));
                rows.add(yearly(CALIBRATION_DESC, d.minusYears(2), d.minusDays(30)));
            }
            case MIXED -> {
                // Three types: accuracy and calibration cover, maintenance does not
                rows.add(yearly(ACCURACY_DESC, d.minusYears(1), d.plusYears(1)));
                rows.add(yearly(CALIBRATION_DESC, d.minusMonths(6), d.plusMonths(6)));
                rows.add(yearly(MAINTENANCE_DESC, d.minusYears(3), d.minusDays(60)));
            }
        }
        return List.copyOf(rows);
    }

    /**
     * A certificate row with "YEARLY" period text, matching the shape of real certificate page data.
     * The coverage window is derived from certifiedDate/expiryDate by the period parser's keyword fallback,
     * just as for real certificates whose period column says "YEARLY" instead of a date range.
     */
    private static CertificateRef yearly(String description, LocalDate certifiedDate, LocalDate expiryDate) {
        return new CertificateRef(description, "Camera", "YEARLY",
                certifiedDate.atStartOfDay(), expiryDate.atTime(23, 59),
                certifiedDate.atStartOfDay(), expiryDate.atStartOfDay(), null);
    }
}
