package cevoc.domain;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;

/**
 * Decides which certificates matter for an offence and what they say about the camera. Pure domain logic.
 * <ul>
 *   <li>If one or more certificates were in force at the offence time: those (at most {@value #MAX_SHOWN}, newest first), status covered.</li>
 *   <li>Otherwise the certificate that expired most recently before the offence and the one that starts soonest after it
 *       (either may be missing), status gap, with the gap measured in whole days.</li>
 *   <li>No usable certificate: nothing listed, status none.</li>
 * </ul>
 * Certificates whose Period could not be read are ignored. Older or later certificates have no bearing and are dropped.
 */
public record CertificateAssessment(List<CertificateItem> certificates, CertificateCoverage coverage) {

    static final int MAX_SHOWN = 3;

    public CertificateAssessment {
        certificates = List.copyOf(certificates);
    }

    public static CertificateAssessment of(List<CertificateRef> all, LocalDateTime offenceAt) {
        List<CertificateRef> usable = all == null ? List.of() : all.stream()
                .filter(c -> c != null && c.periodFrom() != null && c.periodTo() != null).toList();
        if (usable.isEmpty() || offenceAt == null) {
            String msg = all == null || all.isEmpty() ? "We found no certificates for this camera around the offence date."
                    : "We found certificates for this camera but could not read their dates.";
            return new CertificateAssessment(List.of(), new CertificateCoverage(CertificateCoverage.Status.NONE, null, null, msg));
        }
        List<CertificateRef> covering = usable.stream().filter(c -> c.covers(offenceAt))
                .sorted(Comparator.comparing(CertificateRef::periodFrom).reversed()).limit(MAX_SHOWN).toList();
        if (!covering.isEmpty()) {
            return new CertificateAssessment(covering.stream().map(c -> CertificateItem.from(c, true)).toList(),
                    new CertificateCoverage(CertificateCoverage.Status.COVERED, null, null,
                            "A certificate for this camera was in force on the offence date."));
        }
        CertificateRef before = usable.stream().filter(c -> c.periodTo().isBefore(offenceAt))
                .max(Comparator.comparing(CertificateRef::periodTo)).orElse(null);
        CertificateRef after = usable.stream().filter(c -> c.periodFrom().isAfter(offenceAt))
                .min(Comparator.comparing(CertificateRef::periodFrom)).orElse(null);
        List<CertificateItem> shown = new java.util.ArrayList<>();
        if (before != null) {
            shown.add(CertificateItem.from(before, false));
        }
        if (after != null) {
            shown.add(CertificateItem.from(after, false));
        }
        if (before != null && after != null) {
            long gap = Math.max(0, ChronoUnit.DAYS.between(before.periodTo().toLocalDate(), after.periodFrom().toLocalDate()) - 1);
            String msg = gap == 0 ? "The camera was certified continuously around the offence date."
                    : "There is a " + gap + " day gap in certification around the offence date.";
            return new CertificateAssessment(shown, new CertificateCoverage(CertificateCoverage.Status.GAP,
                    CertificateCoverage.Side.BETWEEN, gap, msg));
        }
        if (before != null) {
            long days = ChronoUnit.DAYS.between(before.periodTo().toLocalDate(), offenceAt.toLocalDate());
            String msg = days == 0 ? "The most recent certificate expired earlier on the day of the offence."
                    : "The most recent certificate expired " + days(days) + " before the offence.";
            return new CertificateAssessment(shown, new CertificateCoverage(CertificateCoverage.Status.GAP,
                    CertificateCoverage.Side.BEFORE_ONLY, days, msg));
        }
        long days = ChronoUnit.DAYS.between(offenceAt.toLocalDate(), after.periodFrom().toLocalDate());
        String msg = days == 0 ? "The next certificate starts later on the day of the offence."
                : "The next certificate starts " + days(days) + " after the offence.";
        return new CertificateAssessment(shown, new CertificateCoverage(CertificateCoverage.Status.GAP,
                CertificateCoverage.Side.AFTER_ONLY, days, msg));
    }

    private static String days(long n) {
        return n == 1 ? "1 day" : n + " days";
    }
}
