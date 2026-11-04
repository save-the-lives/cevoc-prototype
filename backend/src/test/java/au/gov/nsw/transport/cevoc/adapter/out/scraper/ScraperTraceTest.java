package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.adapter.out.scraper.ScraperEvidenceTest.FakeStorage;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.ScraperEvidenceTest.Sessions;
import au.gov.nsw.transport.cevoc.domain.CapturePath;
import au.gov.nsw.transport.cevoc.domain.LookupStep;
import au.gov.nsw.transport.cevoc.domain.LookupTrace;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.StepCause;
import au.gov.nsw.transport.cevoc.domain.StepOutcome;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The step trace the scraper adapter reports, using the fictitious fixtures and fake session (no browser, no network). */
class ScraperTraceTest {

    private static final String BASE = "https://penalty.example.invalid/customer_service/finesonline/";
    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));

    @AfterEach
    void cleanUp() {
        LookupTrace.end();
    }

    private static ScraperEvidenceLookupAdapter adapter(FakeRenderedPageSession fake, RegistrationProvider plates) {
        var settings = new ScraperSettings(true, BASE, "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), Duration.ofSeconds(60), 1024);
        return new ScraperEvidenceLookupAdapter(settings, new Sessions(fake), new RevenueNswPageParser(), new FakeStorage(),
                Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC), plates);
    }

    private static StepOutcome outcome(LookupTrace t, LookupStep s) {
        return t.entries().get(s.ordinal()).outcome();
    }

    @Test
    void aFullRunWithAPlateRecordsEveryBrowserStepOkAndTheImageSizes() {
        LookupTrace t = LookupTrace.begin(true);
        adapter(new FakeRenderedPageSession(), req -> Optional.of("TST123")).find(REQ);

        for (LookupStep s : new LookupStep[] {LookupStep.START_BROWSER, LookupStep.OPEN_LOGIN, LookupStep.SUBMIT_LOGIN,
                LookupStep.READ_SUMMARY, LookupStep.GIVE_PLATE, LookupStep.VIEW_IMAGES, LookupStep.CAPTURE_IMAGES}) {
            assertThat(outcome(t, s)).as(s.label()).isEqualTo(StepOutcome.OK);
        }
        assertThat(t.firstFailed()).isNull();
        // two images had bytes; the second is a real 8x6 PNG captured "via canvas" and rendered at 4x3
        assertThat(t.images()).hasSize(2);
        var z = t.images().get(1);
        assertThat(z.width()).isEqualTo(8);
        assertThat(z.height()).isEqualTo(6);
        assertThat(z.renderedWidth()).isEqualTo(4);
        assertThat(z.naturalWidth()).isEqualTo(8);
        assertThat(z.path()).isEqualTo(CapturePath.CANVAS);
        assertThat(z.bytes()).isEqualTo(FakeRenderedPageSession.png(8, 6).length);
        assertThat(t.capturedImages()).hasSize(2);
    }

    @Test
    void withoutAPlateThePlateAndImageStepsAreSkipped() {
        LookupTrace t = LookupTrace.begin(false);
        adapter(new FakeRenderedPageSession(), RegistrationProvider.none()).find(REQ);
        assertThat(outcome(t, LookupStep.READ_SUMMARY)).isEqualTo(StepOutcome.OK);
        assertThat(t.entries().get(LookupStep.GIVE_PLATE.ordinal()).cause()).isEqualTo(StepCause.NO_PLATE);
        assertThat(outcome(t, LookupStep.VIEW_IMAGES)).isEqualTo(StepOutcome.SKIPPED);
        assertThat(outcome(t, LookupStep.CAPTURE_IMAGES)).isEqualTo(StepOutcome.SKIPPED);
        assertThat(t.firstFailed()).isNull();
        assertThat(t.images()).isEmpty();
    }

    @Test
    void aNoticeThatIsNotMatchedFailsAtReadSummary() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.rejectLogin = true;
        LookupTrace t = LookupTrace.begin(false);
        adapter(fake, RegistrationProvider.none()).find(REQ);
        assertThat(t.firstFailed().step()).isEqualTo(LookupStep.READ_SUMMARY);
        assertThat(t.firstFailed().cause()).isEqualTo(StepCause.NOT_MATCHED);
        assertThat(outcome(t, LookupStep.SUBMIT_LOGIN)).isEqualTo(StepOutcome.OK);
        assertThat(t.entries().get(LookupStep.GIVE_PLATE.ordinal()).cause()).isEqualTo(StepCause.PRIOR_FAILURE);
    }

    @Test
    void aWrongPlateFailsAtViewImagesAndABrowserErrorFailsItsOwnStepWithoutEchoingValues() {
        FakeRenderedPageSession wrong = new FakeRenderedPageSession();
        LookupTrace t = LookupTrace.begin(false);
        adapter(wrong, req -> Optional.of("WRONG1")).find(REQ);
        assertThat(t.firstFailed().step()).isEqualTo(LookupStep.VIEW_IMAGES);
        assertThat(t.firstFailed().cause()).isEqualTo(StepCause.PLATE_NOT_ACCEPTED);
        LookupTrace.end();

        FakeRenderedPageSession broken = new FakeRenderedPageSession();
        broken.failOnPlate = true;
        LookupTrace t2 = LookupTrace.begin(false);
        adapter(broken, req -> Optional.of("TST123")).find(REQ);
        assertThat(t2.firstFailed().step()).isEqualTo(LookupStep.GIVE_PLATE);
        assertThat(t2.entries().toString()).doesNotContain("TST123").doesNotContain("9000000004");
    }

    @Test
    void aSessionThatCannotStartFailsStartBrowser() {
        var settings = new ScraperSettings(true, BASE, "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), Duration.ofSeconds(60), 1024);
        var a = new ScraperEvidenceLookupAdapter(settings, uri -> {
            throw new java.io.IOException("could not start the browser: Executable doesn't exist at /x");
        }, new RevenueNswPageParser(), new FakeStorage(), Clock.systemUTC(), RegistrationProvider.none());
        LookupTrace t = LookupTrace.begin(false);
        a.find(REQ);
        assertThat(t.firstFailed().step()).isEqualTo(LookupStep.START_BROWSER);
        assertThat(t.firstFailed().cause()).isEqualTo(StepCause.BROWSER_NOT_INSTALLED);
    }

    @Test
    void withNoTraceBegunNothingIsRecordedAndTheLookupStillWorks() {
        var r = adapter(new FakeRenderedPageSession(), req -> Optional.of("TST123")).find(REQ);
        assertThat(r.evidence()).hasSize(2);
        assertThat(LookupTrace.current().images()).isEmpty();
    }
}
