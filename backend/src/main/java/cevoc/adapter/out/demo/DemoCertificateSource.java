package cevoc.adapter.out.demo;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
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
 * force, a single row in force, rows none of which is in force, no rows, or a simulated failure whose message makes the
 * lookup record the step cause {@code timeout}. Every row is fictitious sample data.
 */
public final class DemoCertificateSource implements CertificateSourcePort {

    private static final DateTimeFormatter PERIOD = DateTimeFormatter.ofPattern("dd/MM/uuuu");

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
                rows.add(row(what + " (superseded)", d.minusYears(3), d.minusYears(1).minusDays(1)));
                rows.add(row(what + " (current)", d.minusYears(1), d.plusYears(1)));
                rows.add(row(what + " (next year)", d.plusYears(1).plusDays(1), d.plusYears(3)));
            }
            case SINGLE -> rows.add(row(what, d.minusYears(1), d.plusYears(1)));
            case NOT_COVERING -> {
                rows.add(row(what + " (expired before the offence)", d.minusYears(3), d.minusDays(40)));
                rows.add(row(what + " (starts after the offence)", d.plusDays(40), d.plusYears(2)));
            }
            case NONE -> { }
            case FAILED -> throw new IllegalStateException("demo certificate source: timeout (simulated failure)");
        }
        return List.copyOf(rows);
    }

    private static CertificateRef row(String description, LocalDate from, LocalDate to) {
        return new CertificateRef(description, "Camera", PERIOD.format(from) + " - " + PERIOD.format(to), from.atStartOfDay(),
                to.atTime(23, 59), from.minusDays(10).atStartOfDay(), to.atStartOfDay(), null);
    }
}
