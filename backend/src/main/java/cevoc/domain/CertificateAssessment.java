package cevoc.domain;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Decides which certificates matter for an offence and what they say about the camera. Pure domain logic.
 * <p>
 * Certificates are grouped by description (case-insensitive trim) — each distinct description is one "type".
 * Per type, exactly one certificate is shown: the one covering the offence date (tie-break: latest certifiedDate).
 * Types with no covering certificate produce an uncovered-type message instead of a card.
 * <p>
 * Overall headline: "This camera was certified at the time of the offence" only when every type is covered.
 * Otherwise: "Some camera certificates may not have been in force on the offence date."
 */
public record CertificateAssessment(List<CertificateItem> certificates, CertificateCoverage coverage,
                                    List<UncoveredType> uncoveredTypes) {

    /** Default look-back window in years. */
    static final int LOOKBACK_YEARS = 2;

    public CertificateAssessment {
        certificates = List.copyOf(certificates);
        uncoveredTypes = uncoveredTypes == null ? List.of() : List.copyOf(uncoveredTypes);
    }

    /** An uncovered certificate type: no certificate of this description covered the offence date. */
    public record UncoveredType(String description, Long gapDays, String message) {}

    public static CertificateAssessment of(List<CertificateRef> all, LocalDateTime offenceAt) {
        return of(all, offenceAt, LOOKBACK_YEARS);
    }

    public static CertificateAssessment of(List<CertificateRef> all, LocalDateTime offenceAt, int lookbackYears) {
        List<CertificateRef> usable = all == null ? List.of() : all.stream()
                .filter(c -> c != null && c.periodFrom() != null && c.periodTo() != null).toList();
        if (usable.isEmpty() || offenceAt == null) {
            String msg = all == null || all.isEmpty() ? "We found no certificates for this camera around the offence date."
                    : "We found certificates for this camera but could not read their dates.";
            return new CertificateAssessment(List.of(), new CertificateCoverage(CertificateCoverage.Status.NONE, null, null, msg), List.of());
        }

        // Apply look-back window: only consider certificates within N years of the offence
        LocalDateTime cutoff = offenceAt.minusYears(lookbackYears);
        usable = usable.stream().filter(c -> !c.periodTo().isBefore(cutoff)).toList();
        if (usable.isEmpty()) {
            return new CertificateAssessment(List.of(),
                    new CertificateCoverage(CertificateCoverage.Status.NONE, null, null,
                            "We found no certificates for this camera within " + lookbackYears + " years of the offence date."),
                    List.of());
        }

        // Group by description (case-insensitive trim) — each distinct description = one type
        Map<String, List<CertificateRef>> byType = usable.stream()
                .collect(Collectors.groupingBy(CertificateAssessment::dedupKey, LinkedHashMap::new, Collectors.toList()));

        List<CertificateItem> covered = new ArrayList<>();
        List<UncoveredType> uncovered = new ArrayList<>();

        for (Map.Entry<String, List<CertificateRef>> entry : byType.entrySet()) {
            List<CertificateRef> group = entry.getValue();
            String typeDesc = group.get(0).description(); // original casing

            // Find certs that cover the offence date
            List<CertificateRef> covering = group.stream().filter(c -> c.covers(offenceAt)).toList();
            if (!covering.isEmpty()) {
                // Pick the one with the latest certifiedDate
                CertificateRef best = covering.stream()
                        .max(Comparator.comparing(c -> c.certifiedDate() == null ? LocalDateTime.MIN : c.certifiedDate()))
                        .orElse(covering.get(0));
                covered.add(CertificateItem.from(best, true));
            } else {
                // No certificate of this type covers the offence date — compute gap
                CertificateRef before = group.stream().filter(c -> c.periodTo().isBefore(offenceAt))
                        .max(Comparator.comparing(CertificateRef::periodTo)).orElse(null);
                CertificateRef after = group.stream().filter(c -> c.periodFrom().isAfter(offenceAt))
                        .min(Comparator.comparing(CertificateRef::periodFrom)).orElse(null);
                Long gapDays = null;
                if (before != null) {
                    gapDays = ChronoUnit.DAYS.between(before.periodTo().toLocalDate(), offenceAt.toLocalDate());
                } else if (after != null) {
                    gapDays = ChronoUnit.DAYS.between(offenceAt.toLocalDate(), after.periodFrom().toLocalDate());
                }
                String gapText = gapDays != null ? " (" + days(gapDays) + " gap)" : "";
                String msg = "No " + typeDesc + " certificate covered the offence date" + gapText + ".";
                uncovered.add(new UncoveredType(typeDesc, gapDays, msg));
            }
        }

        // Overall status
        boolean allCovered = uncovered.isEmpty() && !covered.isEmpty();
        String headline;
        CertificateCoverage.Status status;
        if (allCovered) {
            status = CertificateCoverage.Status.COVERED;
            headline = "This camera was certified at the time of the offence.";
        } else if (covered.isEmpty()) {
            status = CertificateCoverage.Status.GAP;
            headline = "Some camera certificates may not have been in force on the offence date.";
        } else {
            status = CertificateCoverage.Status.GAP;
            headline = "Some camera certificates may not have been in force on the offence date.";
        }

        return new CertificateAssessment(covered,
                new CertificateCoverage(status, null, null, headline),
                uncovered);
    }

    private static String days(long n) {
        return n == 1 ? "1 day" : n + " days";
    }

    /** Key for grouping: same description means the same certificate type. */
    private static String dedupKey(CertificateRef c) {
        return c.description() == null ? "" : c.description().trim().toLowerCase(Locale.ROOT);
    }
}
