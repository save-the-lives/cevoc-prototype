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

    @Test
    void failureDetailIsPrintedFromTheFixedVocabularyOnly() {
        PenaltyLookupResult un = new PenaltyLookupResult(Status.UNAVAILABLE, "9000000004", "x", null, List.of(), "S");
        String reason = au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("browser step 'login' failed: Timeout 30000ms exceeded for TST123 at 9000000004");
        assertThat(reason).isEqualTo("step=login; cause=timeout");
        String s = LiveCheckSummary.of(un, reason);
        assertThat(s).contains("failure detail     : step=login; cause=timeout");
        assertThat(s).doesNotContain("9000000004").doesNotContain("TST123");
        assertThat(LiveCheckSummary.of(un)).doesNotContain("failure detail");
    }

    @Test
    void diagnosticMapsKnownBrowserFailures() {
        assertThat(au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("could not start the browser: Executable doesn't exist at /x")).isEqualTo("step=start; cause=browser-not-installed");
        assertThat(au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("browser step 'login' failed: Navigation failed because net::ERR_NAME_NOT_RESOLVED")).isEqualTo("step=login; cause=ERR_NAME_NOT_RESOLVED");
        assertThat(au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("browser step 'submit-login' failed: IllegalStateException")).isEqualTo("step=submit-login; cause=IllegalStateException");
        String page = au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic
                .fromUnreadablePage("login", "<html><body>Access Denied 9000000004</body></html>");
        assertThat(page).contains("looks-blocked=yes").contains("has-pnn-field=no").doesNotContain("9000000004");
    }
}
