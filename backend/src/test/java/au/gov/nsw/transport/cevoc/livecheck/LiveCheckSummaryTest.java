package au.gov.nsw.transport.cevoc.livecheck;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult.Status;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class LiveCheckSummaryTest {

    private static NoticeDetails notice() {
        return new NoticeDetails("Camera recorded", LocalDate.of(2026, 1, 15), LocalTime.of(11, 12), "SAMPLE ROAD, SAMPLETOWN",
                new BigDecimal("277.00"), new BigDecimal("277.00"), NoticeStatus.PAYABLE, "payable",
                EnforcementMethod.CAMERA);
    }

    @Test
    void summaryHasCountsAndYesNoButNoValues() {
        List<EvidenceItem> ev = List.of(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Camera image 700-1-000000001", "k1"),
                EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Camera image 700-1-000000002", "k2"));
        PenaltyLookupResult r = new PenaltyLookupResult(Status.FOUND, "9000000004", "Content from the penalty page.", notice(), ev,
                "SCRAPER_EVIDENCE", "7109");
        String s = LiveCheckSummary.of(r);
        assertThat(s).contains("3 images").contains("images             : 2").contains("camera code found  : yes")
                .contains("certificates       : 0").contains("location: yes");
        assertThat(s).doesNotContain("9000000004").doesNotContain("7109").doesNotContain("SAMPLE ROAD")
                .doesNotContain("277").doesNotContain("700-1-").doesNotContain("TST123").doesNotContain("2026");
    }

    @Test
    void statesAreNamedForEveryStatus() {
        PenaltyLookupResult off = new PenaltyLookupResult(Status.LIVE_LOOKUP_OFF, "9000000004", "x", null, List.of(), "S");
        PenaltyLookupResult nf = new PenaltyLookupResult(Status.NOT_FOUND, "9000000004", "x", null, List.of(), "S");
        PenaltyLookupResult un = new PenaltyLookupResult(Status.UNAVAILABLE, "9000000004", "x", null, List.of(), "S");
        PenaltyLookupResult summaryOnly = new PenaltyLookupResult(Status.FOUND, "9000000004", "x", notice(), List.of(), "S");
        assertThat(LiveCheckSummary.state(off)).startsWith("none");
        assertThat(LiveCheckSummary.state(nf)).startsWith("1 login");
        assertThat(LiveCheckSummary.state(un)).startsWith("failed");
        assertThat(LiveCheckSummary.state(summaryOnly)).startsWith("2 summary");
        assertThat(LiveCheckSummary.of(un)).contains("(no notice details)").contains("camera code found  : no");
    }
}
