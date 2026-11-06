package cevoc.domain;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.domain.CertificateCoverage.Side;
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
    void oneCertificateInForceIsShownAloneAndOldOnesAreDropped() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("years ago", "2019-01-01", "2020-12-31"),
                cert("covering", "2026-01-01", "2026-12-31"),
                cert("far future", "2030-01-01", "2031-12-31")), OFFENCE);
        assertThat(names(a)).containsExactly("covering");
        assertThat(a.certificates().get(0).coversOffence()).isTrue();
        assertThat(a.coverage().status()).isEqualTo(Status.COVERED);
        assertThat(a.coverage().side()).isNull();
        assertThat(a.coverage().gapDays()).isNull();
        assertThat(a.coverage().message()).isEqualTo("A certificate for this camera was in force on the offence date.");
    }

    @Test
    void severalInForceAreCappedAtThreeNewestFirst() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("a", "2026-01-01", "2026-12-31"), cert("b", "2026-02-01", "2026-12-31"),
                cert("c", "2026-03-01", "2026-12-31"), cert("d", "2026-04-01", "2026-12-31")), OFFENCE);
        assertThat(names(a)).containsExactly("d", "c", "b");
        assertThat(a.certificates()).allMatch(CertificateItem::coversOffence);
    }

    @Test
    void expiredThenFutureWithAGapShowsBothAndTheGapInDays() {
        // expired 31 May, next starts 10 July: 1 June to 9 July is 39 days with no certificate
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("long ago", "2020-01-01", "2021-12-31"),
                cert("before", "2025-06-01", "2026-05-31"),
                cert("after", "2026-07-10", "2027-07-09"),
                cert("much later", "2028-01-01", "2029-12-31")), OFFENCE);
        assertThat(names(a)).containsExactly("before", "after");
        assertThat(a.certificates()).noneMatch(CertificateItem::coversOffence);
        assertThat(a.coverage().status()).isEqualTo(Status.GAP);
        assertThat(a.coverage().side()).isEqualTo(Side.BETWEEN);
        assertThat(a.coverage().gapDays()).isEqualTo(39);
        assertThat(a.coverage().message()).isEqualTo("There is a 39 day gap in certification around the offence date.");
    }

    @Test
    void unsortedInputGivesTheSameAnswer() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("after", "2026-07-10", "2027-07-09"), cert("long ago", "2020-01-01", "2021-12-31"),
                cert("before", "2025-06-01", "2026-05-31")), OFFENCE);
        assertThat(names(a)).containsExactly("before", "after");
        assertThat(a.coverage().gapDays()).isEqualTo(39);
    }

    @Test
    void expiredThenFutureBackToBackIsContinuous() {
        // Times inside one day: the first Period ends at 10:00 and the next starts at 11:00 on the offence day, so the
        // offence minute (10:30) is in neither, yet no whole day is missing.
        CertificateRef before = new CertificateRef("before", "Camera", "p", LocalDateTime.of(2025, 6, 16, 0, 0),
                LocalDateTime.of(2026, 6, 15, 10, 0), null, null, null);
        CertificateRef after = new CertificateRef("after", "Camera", "p", LocalDateTime.of(2026, 6, 15, 11, 0),
                LocalDateTime.of(2027, 6, 15, 23, 59), null, null, null);
        CertificateAssessment a = CertificateAssessment.of(List.of(after, before), OFFENCE);
        assertThat(names(a)).containsExactly("before", "after");
        assertThat(a.coverage().status()).isEqualTo(Status.GAP);
        assertThat(a.coverage().side()).isEqualTo(Side.BETWEEN);
        assertThat(a.coverage().gapDays()).isZero();
        assertThat(a.coverage().message()).isEqualTo("The camera was certified continuously around the offence date.");
    }

    @Test
    void consecutiveDatesAreContinuous() {
        // Ends 14 June, next starts 15 June: nothing missing. The offence falls in the last seconds of 14 June, after the
        // 23:59 end and before the 00:00 start.
        LocalDateTime between = LocalDateTime.of(2026, 6, 14, 23, 59, 30);
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("before", "2025-06-15", "2026-06-14"), cert("after", "2026-06-15", "2027-06-14")), between);
        assertThat(names(a)).containsExactly("before", "after");
        assertThat(a.coverage().gapDays()).isZero();
        assertThat(a.coverage().message()).isEqualTo("The camera was certified continuously around the offence date.");
    }

    @Test
    void onlyEarlierCertificatesSayHowLongAgoTheLastOneExpired() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("older", "2023-01-01", "2024-12-31"), cert("latest", "2025-06-01", "2026-06-05")), OFFENCE);
        assertThat(names(a)).containsExactly("latest");
        assertThat(a.coverage().status()).isEqualTo(Status.GAP);
        assertThat(a.coverage().side()).isEqualTo(Side.BEFORE_ONLY);
        assertThat(a.coverage().gapDays()).isEqualTo(10);
        assertThat(a.coverage().message()).isEqualTo("The most recent certificate expired 10 days before the offence.");
    }

    @Test
    void onlyEarlierCertificateExpiredYesterdayUsesTheSingular() {
        CertificateAssessment a = CertificateAssessment.of(List.of(cert("latest", "2025-06-01", "2026-06-14")), OFFENCE);
        assertThat(a.coverage().message()).isEqualTo("The most recent certificate expired 1 day before the offence.");
    }

    @Test
    void onlyLaterCertificatesSayHowSoonTheNextOneStarts() {
        CertificateAssessment a = CertificateAssessment.of(List.of(
                cert("next", "2026-06-25", "2027-06-24"), cert("after that", "2027-06-25", "2028-06-24")), OFFENCE);
        assertThat(names(a)).containsExactly("next");
        assertThat(a.coverage().status()).isEqualTo(Status.GAP);
        assertThat(a.coverage().side()).isEqualTo(Side.AFTER_ONLY);
        assertThat(a.coverage().gapDays()).isEqualTo(10);
        assertThat(a.coverage().message()).isEqualTo("The next certificate starts 10 days after the offence.");
    }

    @Test
    void theCoverageSerialisesToTheAgreedWireShape() throws Exception {
        ObjectMapper m = new ObjectMapper();
        CertificateAssessment gap = CertificateAssessment.of(List.of(
                cert("before", "2025-06-01", "2026-05-31"), cert("after", "2026-07-10", "2027-07-09")), OFFENCE);
        assertThat(m.readTree(m.writeValueAsString(gap.coverage())).toString())
                .isEqualTo("{\"status\":\"gap\",\"side\":\"between\",\"gapDays\":39,\"message\":\"There is a 39 day gap in certification around the offence date.\"}");
        CertificateAssessment covered = CertificateAssessment.of(List.of(cert("c", "2026-01-01", "2026-12-31")), OFFENCE);
        assertThat(m.readTree(m.writeValueAsString(covered.coverage())).fieldNames()).toIterable().containsExactly("status", "message");
    }
}
