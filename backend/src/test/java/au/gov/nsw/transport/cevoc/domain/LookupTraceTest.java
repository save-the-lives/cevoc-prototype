package au.gov.nsw.transport.cevoc.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class LookupTraceTest {

    @AfterEach
    void cleanUp() {
        LookupTrace.end();
    }

    @Test
    void vocabularyIsFixedAndOrdered() {
        assertThat(LookupStep.values()).extracting(LookupStep::label).containsExactly("start-browser", "open-login", "submit-login",
                "read-summary", "give-plate", "view-images", "capture-images", "certificates");
        assertThat(LookupStep.READ_SUMMARY.number()).isEqualTo(4);
    }

    @Test
    void recordsOkAndFailedStepsAndFillsTheRestAsSkipped() throws Exception {
        LookupTrace t = LookupTrace.begin(false);
        assertThat(t.run(LookupStep.START_BROWSER, () -> "session")).isEqualTo("session");
        assertThatThrownBy(() -> t.run(LookupStep.OPEN_LOGIN, () -> {
            throw new IOException("browser step 'login' failed: Timeout 30000ms exceeded for TST123 at 9000000004");
        })).isInstanceOf(IOException.class);

        var entries = t.entries();
        assertThat(entries).hasSize(8);
        assertThat(entries.get(0).outcome()).isEqualTo(StepOutcome.OK);
        assertThat(entries.get(1).outcome()).isEqualTo(StepOutcome.FAILED);
        assertThat(entries.get(1).cause()).isEqualTo(StepCause.TIMEOUT);
        assertThat(entries.get(2).outcome()).isEqualTo(StepOutcome.SKIPPED);
        assertThat(entries.get(2).cause()).isEqualTo(StepCause.PRIOR_FAILURE);
        assertThat(t.firstFailed().step()).isEqualTo(LookupStep.OPEN_LOGIN);
        // causes are tokens from the whitelist; no echo of the message
        assertThat(entries.toString()).doesNotContain("TST123").doesNotContain("9000000004");
    }

    @Test
    void failOverridesAnOkStepButKeepsItsDuration() {
        LookupTrace t = LookupTrace.begin(false);
        t.ok(LookupStep.READ_SUMMARY, 820);
        t.fail(LookupStep.READ_SUMMARY, StepCause.NOT_MATCHED);
        var e = t.entries().get(3);
        assertThat(e.outcome()).isEqualTo(StepOutcome.FAILED);
        assertThat(e.millis()).isEqualTo(820);
        assertThat(e.cause().token()).isEqualTo("not-matched");
    }

    @Test
    void withoutABeginnerTheCurrentTraceIsInertAndRecordsNothing() {
        LookupTrace t = LookupTrace.current();
        t.ok(LookupStep.OPEN_LOGIN, 5);
        t.image(new ImageSize(1, 1, 1, 1, 1, 1, 3, CapturePath.CANVAS), "image/png", new byte[] {1});
        assertThat(t.firstFailed()).isNull();
        assertThat(t.images()).isEmpty();
        assertThat(t.capturedImages()).isEmpty();
        assertThat(t.entries()).allMatch(e -> e.outcome() == StepOutcome.SKIPPED);
    }

    @Test
    void imageBytesAreRetainedOnlyWhenAskedAndForgottenWhenTheTraceEnds() {
        LookupTrace off = LookupTrace.begin(false);
        off.image(new ImageSize(8, 6, 4, 3, 8, 6, 3, CapturePath.CANVAS), "image/png", new byte[] {1, 2, 3});
        assertThat(off.images()).hasSize(1);
        assertThat(off.capturedImages()).isEmpty();
        LookupTrace.end();

        LookupTrace on = LookupTrace.begin(true);
        on.image(new ImageSize(8, 6, 4, 3, 8, 6, 3, CapturePath.CANVAS), "image/png", new byte[] {1, 2, 3});
        assertThat(on.capturedImages()).hasSize(1);
        assertThat(on.capturedImages().get(0).toString()).isEqualTo("Captured");
        LookupTrace.end();
        assertThat(LookupTrace.current().capturedImages()).isEmpty();
    }
}
