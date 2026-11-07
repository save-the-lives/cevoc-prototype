package cevoc.domain;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.domain.CertificateCoverage.Status;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Which certificates matter for an offence, and the plain answer they give. Fictitious dates throughout. */
class CertificateAssessmentTest {

    private static final LocalDateTime OFFENCE = LocalDateTime.of(2026, 6, 15, 10, 30);

    /** A date-only Period, held the way the parser holds it: start of the first day to the end of the last. */
    private static CertificateRef cert(String name, String from, String to) {
        LocalDate f = LocalDate.parse(from);
        LocalDate t = LocalDate.parse(to);
        return new CertificateRef(name, "Camera", from + " - " + to, f.atStartOfDay(), t.atTime(23, 59),
                f.atStartOfDay(), t.atStartOfDay(), null);
    }

    /** Cert with a specific certifiedDate for tie-breaking. */
    private static CertificateRef certWithCertDate(String name, String from, String to, String certDate) {
        LocalDate f = LocalDate.parse(from);
        LocalDate t = LocalDate.parse(to);
        LocalDate cd = LocalDate.parse(certDate);
        return new CertificateRef(name, "Camera", from + " - " + to, f.atStartOfDay(), t.atTime(23, 59),
                cd.atStartOfDay(), t.atStartOfDay(), null);
    }

    private static List<String> names(CertificateAssessment a) {
        return a.certificates().stream().map(CertificateItem::description).toList();
    }

    @Test
    void noCertificatesAtAll() {
        CertificateAssessment a = CertificateAssessment.of(List.of(), OFFENCE);
        assertThat(a.certificates()).isEmpty();
        assertThat(a.coverage().status()).isEqualTo(Status.NONE);
        assertThat(a.coverage().gapDays()).isNull();
        assertThat(a.coverage().message()).isEqualTo("We found no certificates for this camera around the offence date.");
        assertThat(CertificateAssessment.of(null, OFFENCE).coverage().status()).isEqualTo(Status.NONE);
    }

    @Test
    void rowsWithoutReadableDatesAreIgnored() {
        CertificateRef unreadable = new CertificateRef("x", "Camera", "???", null, null, null, null, null);
        CertificateAssessment a = CertificateAssessment.of(List.of(unreadable), OFFENCE);
        assertThat(a.certificates()).isEmpty();
        assertThat(a.coverage().status()).isEqualTo(Status.NONE);
        assertThat(a.coverage().message()).contains("could not read");
    }

    @Test
    void oneTypeOneCoveringCertificate() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2026-01-01", "2026-12-31")), OFFENCE);
        assertThat(names(a)).containsExactly("Yearly");
        assertThat(a.certificates().get(0).coversOffence()).isTrue();
        assertThat(a.coverage().status()).isEqualTo(Status.COVERED);
        assertThat(a.coverage().message()).isEqualTo("This camera was certified at the time of the offence.");
        assertThat(a.uncoveredTypes()).isEmpty();
    }

    @Test
    void twoTypesAllCoveredHeadlineIsCovered() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2026-01-01", "2026-12-31"),
                cert("Quarterly", "2026-04-01", "2026-09-30")), OFFENCE);
        assertThat(names(a)).containsExactly("Yearly", "Quarterly");
        assertThat(a.coverage().status()).isEqualTo(Status.COVERED);
        assertThat(a.coverage().message()).isEqualTo("This camera was certified at the time of the offence.");
        assertThat(a.uncoveredTypes()).isEmpty();
    }

    @Test
    void oneTypeUncoveredProducesPartialHeadline() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2026-01-01", "2026-12-31"),
                cert("Quarterly", "2025-01-01", "2026-03-31")), OFFENCE);
        assertThat(names(a)).containsExactly("Yearly");
        assertThat(a.coverage().status()).isEqualTo(Status.GAP);
        assertThat(a.coverage().message()).isEqualTo("Some camera certificates may not have been in force on the offence date.");
        assertThat(a.uncoveredTypes()).hasSize(1);
        assertThat(a.uncoveredTypes().get(0).description()).isEqualTo("Quarterly");
        assertThat(a.uncoveredTypes().get(0).message()).contains("No Quarterly certificate covered the offence date");
    }

    @Test
    void uncoveredTypeShowsGapDays() {
        // Quarterly expired on 31 March, offence on 15 June: 76 days gap
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2026-01-01", "2026-12-31"),
                cert("Quarterly", "2025-04-01", "2026-03-31")), OFFENCE);
        CertificateAssessment.UncoveredType u = a.uncoveredTypes().get(0);
        assertThat(u.gapDays()).isEqualTo(76);
        assertThat(u.message()).contains("76 days gap");
    }

    @Test
    void dedupBySameDescriptionKeepsCoveringWithLatestCertifiedDate() {
        // Two certs with the same description both cover, but different certifiedDate
        CertificateAssessment a = CertificateAssessment.of(List.of(
                certWithCertDate("Yearly", "2026-01-01", "2026-12-31", "2026-01-15"),
                certWithCertDate("Yearly", "2026-03-01", "2026-12-31", "2026-03-15")), OFFENCE);
        assertThat(a.certificates()).hasSize(1);
        // Should pick the one with latest certifiedDate (2026-03-15)
        assertThat(a.certificates().get(0).certifiedDate()).isEqualTo("2026-03-15");
    }

    @Test
    void dedupIsCaseInsensitive() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("YEARLY", "2026-01-01", "2026-12-31"),
                cert("yearly", "2026-02-01", "2026-12-31")), OFFENCE);
        assertThat(a.certificates()).hasSize(1);
    }

    @Test
    void oldCertificatesOutsideLookbackAreIgnored() {
        // Lookback is 2 years. A cert from 3 years ago should be ignored.
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2022-01-01", "2023-06-14")), OFFENCE);
        assertThat(a.certificates()).isEmpty();
        assertThat(a.coverage().status()).isEqualTo(Status.NONE);
        assertThat(a.coverage().message()).contains("within 2 years");
    }

    @Test
    void certWithinLookbackIsKept() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2025-01-01", "2025-12-31")), OFFENCE);
        // Not covering, but within lookback — should appear as uncovered type
        assertThat(a.uncoveredTypes()).hasSize(1);
    }

    @Test
    void allTypesUncoveredShowsGapHeadline() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2025-01-01", "2025-12-31"),
                cert("Quarterly", "2025-04-01", "2026-03-31")), OFFENCE);
        assertThat(a.certificates()).isEmpty();
        assertThat(a.uncoveredTypes()).hasSize(2);
        assertThat(a.coverage().status()).isEqualTo(Status.GAP);
        assertThat(a.coverage().message()).isEqualTo("Some camera certificates may not have been in force on the offence date.");
    }

    @Test
    void theCoverageSerialisesToTheAgreedWireShape() throws Exception {
        ObjectMapper m = new ObjectMapper();
        CertificateAssessment covered = CertificateAssessment.of(List.of(cert("c", "2026-01-01", "2026-12-31")), OFFENCE);
        assertThat(m.readTree(m.writeValueAsString(covered.coverage())).get("status").asText()).isEqualTo("covered");
        assertThat(m.readTree(m.writeValueAsString(covered.coverage())).get("message").asText())
                .isEqualTo("This camera was certified at the time of the offence.");
    }

    @Test
    void uncoveredTypesSerialiseProperly() throws Exception {
        ObjectMapper m = new ObjectMapper();
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("Yearly", "2026-01-01", "2026-12-31"),
                cert("Quarterly", "2025-04-01", "2026-03-31")), OFFENCE);
        String json = m.writeValueAsString(a);
        var tree = m.readTree(json);
        assertThat(tree.get("uncoveredTypes").size()).isEqualTo(1);
        assertThat(tree.get("uncoveredTypes").get(0).get("description").asText()).isEqualTo("Quarterly");
    }
}
