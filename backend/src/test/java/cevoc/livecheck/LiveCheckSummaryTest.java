package cevoc.livecheck;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.domain.EnforcementMethod;
import cevoc.domain.EvidenceItem;
import cevoc.domain.NoticeDetails;
import cevoc.domain.NoticeStatus;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.PenaltyLookupResult.Status;
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
        String reason = cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("browser step 'login' failed: Timeout 30000ms exceeded for TST123 at 9000000004");
        assertThat(reason).isEqualTo("step=login; cause=timeout");
        String s = LiveCheckSummary.of(un, reason);
        assertThat(s).contains("failure detail     : step=login; cause=timeout");
        assertThat(s).doesNotContain("9000000004").doesNotContain("TST123");
        assertThat(LiveCheckSummary.of(un)).doesNotContain("failure detail");
    }

    @Test
    void diagnosticMapsKnownBrowserFailures() {
        assertThat(cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("could not start the browser: Executable doesn't exist at /x")).isEqualTo("step=start; cause=browser-not-installed");
        assertThat(cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("browser step 'login' failed: Navigation failed because net::ERR_NAME_NOT_RESOLVED")).isEqualTo("step=login; cause=ERR_NAME_NOT_RESOLVED");
        assertThat(cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("browser step 'submit-login' failed: IllegalStateException")).isEqualTo("step=submit-login; cause=IllegalStateException");
        String page = cevoc.adapter.out.scraper.LookupDiagnostic
                .fromUnreadablePage("login", "<html><body>Access Denied 9000000004</body></html>");
        assertThat(page).contains("looks-blocked=yes").contains("has-pnn-field=no").doesNotContain("9000000004");
        String structure = cevoc.adapter.out.scraper.LookupDiagnostic.fromUnreadablePage("login",
                "<html><body><app-root><form><input id=\"pnn\" type=\"text\"><input formcontrolname=\"dateOfOffence\"></form>"
                        + "<button>Next</button> Sample words 9000000004</app-root></body></html>");
        assertThat(structure).contains("inputs=2").contains("forms=1").contains("pnn-by=no/yes/no")
                .contains("dateOfOffence-by=no/no/yes").contains("app-root=yes").doesNotContain("Sample").doesNotContain("9000000004");

        cevoc.adapter.out.scraper.LookupDiagnostic.clear();
        cevoc.adapter.out.scraper.LookupDiagnostic.note("pnn-kept=yes");
        cevoc.adapter.out.scraper.LookupDiagnostic.note("after-next "
                + cevoc.adapter.out.scraper.LookupDiagnostic.structureOf("<html><body><input id=\"pnn\"></body></html>"));
        assertThat(cevoc.adapter.out.scraper.LookupDiagnostic.take())
                .startsWith("pnn-kept=yes; after-next inputs=1");
    }

    @Test
    void traceIsPrintedOneLinePerStepAndTheFirstFailureIsNamed() {
        var t = cevoc.domain.LookupTrace.begin(false);
        try {
            t.ok(cevoc.domain.LookupStep.START_BROWSER, 1500);
            t.ok(cevoc.domain.LookupStep.OPEN_LOGIN, 40);
            t.ok(cevoc.domain.LookupStep.SUBMIT_LOGIN, 2100);
            t.ok(cevoc.domain.LookupStep.READ_SUMMARY, 820);
            t.fail(cevoc.domain.LookupStep.READ_SUMMARY, cevoc.domain.StepCause.PAGE_NOT_RECOGNISED);
        } finally {
            cevoc.domain.LookupTrace.end();
        }
        PenaltyLookupResult un = new PenaltyLookupResult(Status.UNAVAILABLE, "9000000004", "x", null, List.of(), "S");
        String s = LiveCheckSummary.of(un, null, t);
        assertThat(s).contains("step 1 start-browser : ok 1500ms")
                .contains("step 4 read-summary : failed 820ms cause=page-not-recognised")
                .contains("step 5 give-plate : skipped 0ms cause=prior-failure")
                .contains("step 8 certificates : skipped 0ms cause=prior-failure")
                .contains("first failed step  : 4 read-summary (page-not-recognised)");
        assertThat(s.lines().filter(l -> l.startsWith("step ")).count()).isEqualTo(8);
        assertThat(LiveCheckSummary.of(un, null, null)).doesNotContain("step 1");
    }
}
