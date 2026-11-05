package cevoc.adapter.out.revenuensw;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.domain.EnforcementMethod;
import cevoc.domain.NoticeStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** Parsing of the summary call, using invented recorded-shape fixtures only. */
class RevenueNswSummaryMapperTest {

    private static RevenueNswSummaryMapper.Summary map(String fixture) throws Exception {
        return RevenueNswSummaryMapper.map(new ObjectMapper().readTree(FakeTransport.resource(fixture)));
    }

    @Test
    void cameraSummaryFillsTheTypedNoticeDetails() throws Exception {
        var s = map("summary-camera.json");
        var n = s.notice();
        assertThat(s.noticeNumber()).isEqualTo("9000000004");
        assertThat(n.offenceDescription()).isEqualTo("Fictitious offence description");
        assertThat(n.offenceDate()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(n.offenceTime()).isEqualTo(LocalTime.of(10, 20, 30));
        assertThat(n.location()).isEqualTo("Example Road, EXAMPLETOWN");
        assertThat(n.penaltyAmount()).isEqualByComparingTo(new BigDecimal("123"));
        assertThat(n.amountOwing()).isEqualByComparingTo(new BigDecimal("123"));
        assertThat(n.noticeStatus()).isEqualTo(NoticeStatus.PAYABLE);
        assertThat(n.statusMessage()).contains("payable");
        assertThat(n.enforcementMethod()).isEqualTo(EnforcementMethod.CAMERA);
        assertThat(s.imageIds()).containsExactly("fict-img-1", "fict-img-2");
        assertThat(s.imageCount()).isEqualTo(2);
    }

    @Test
    void cameraCodeComesOnlyFromTheSParameterOfTheCertificationLink() throws Exception {
        var s = map("summary-camera.json");
        assertThat(s.cameraCode()).isEqualTo("7109");
        assertThat(RevenueNswSummaryMapper.cameraCode(new ObjectMapper().readTree("\"https://x.example.invalid/a?s=bad%20code&m=1\""))).isNull();
        assertThat(RevenueNswSummaryMapper.cameraCode(new ObjectMapper().readTree("\"not a url\""))).isNull();
    }

    @Test
    void everyOtherFieldFlowsToTheDetailsMapWithoutTheSignedLinkOrIdentifiers() throws Exception {
        var d = map("summary-camera.json").details();
        assertThat(d).containsEntry("demeritPoints", 3).containsEntry("imageCount", 2).containsEntry("seriousOffence", false)
                .containsEntry("imagesCameraCertificationType", "CERT").containsEntry("offenceDemeritDisclaimerCode", "D-FICT-1")
                .containsEntry("paymentTransactionsCount", 0);
        assertThat(d.keySet()).noneMatch(k -> k.toLowerCase().contains("identifiers") || k.toLowerCase().endsWith("ref") || k.equals("pnNum"));
        assertThat(d.values().toString()).doesNotContain("SIGNEDFICTITIOUS").doesNotContain("9000000004").doesNotContain("fict-img");
    }

    @Test
    void paidOfficerIssuedSummaryHasNoCameraAndPaidStatus() throws Exception {
        var s = map("summary-officer.json");
        assertThat(s.notice().enforcementMethod()).isEqualTo(EnforcementMethod.UNKNOWN);
        assertThat(s.notice().noticeStatus()).isEqualTo(NoticeStatus.PAID);
        assertThat(s.notice().offenceDate()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(s.notice().offenceTime()).isEqualTo(LocalTime.of(9, 5));
        assertThat(s.imageIds()).isEmpty();
        assertThat(s.cameraCode()).isNull();
    }

    @Test
    void identifiersThatAreUnsafeInAPathAreDropped() throws Exception {
        assertThat(map("summary-unsafe-ids.json").imageIds()).containsExactly("ok-1");
    }

    @Test
    void keysAreLowerCamelCaseAndLettersOnly() {
        assertThat(RevenueNswSummaryMapper.key("payment.outstanding.currency")).isEqualTo("paymentOutstandingCurrency");
        assertThat(RevenueNswSummaryMapper.key("a_b-c d")).isEqualTo("aBCD");
    }

    @Test
    void textIsTrimmedAndCapped() {
        assertThat(RevenueNswSummaryMapper.clean("  x\u0007y  ")).isEqualTo("x y");
        assertThat(RevenueNswSummaryMapper.clean("a".repeat(900))).hasSize(300);
        assertThat(RevenueNswSummaryMapper.clean("   ")).isNull();
    }
}
