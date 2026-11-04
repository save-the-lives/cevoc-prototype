package au.gov.nsw.transport.cevoc.livecheck;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.domain.CapturePath;
import au.gov.nsw.transport.cevoc.domain.ImageSize;
import au.gov.nsw.transport.cevoc.domain.LookupStep;
import au.gov.nsw.transport.cevoc.domain.LookupTrace;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult.Status;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;

class LiveCheckRunnerTest {

    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));
    private static final byte[] BYTES = {9, 8, 7, 6};

    private static PenaltyLookupResult found() {
        return new PenaltyLookupResult(Status.FOUND, "9000000004", "x", null, List.of(), "S");
    }

    private static final au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase USE_CASE = req -> {
        LookupTrace t = LookupTrace.current();
        t.ok(LookupStep.START_BROWSER, 12);
        t.image(new ImageSize(8, 6, 4, 3, 8, 6, BYTES.length, CapturePath.CANVAS), "image/png", BYTES);
        return found();
    };

    @Test
    void defaultRunKeepsNoImageBytesAndReturnsTextOnly() {
        var out = LiveCheckRunner.run(USE_CASE, REQ, null, false);
        assertThat(out.images()).isEmpty();
        assertThat(out.summary()).contains("step 1 start-browser : ok 12ms").contains("image 1")
                .contains("8x6 px, 4 bytes, via canvas").contains("rendered size: 4x3 px").contains("natural size: 8x6 px")
                .contains("canvas capture may be thumbnail resolution");
        assertThat(out.summary()).doesNotContain(Base64.getEncoder().encodeToString(BYTES)).doesNotContain("9000000004");
    }

    @Test
    void includeImagesReturnsBase64BytesAndSizes() {
        var out = LiveCheckRunner.run(USE_CASE, REQ, null, true);
        assertThat(out.images()).hasSize(1);
        var img = out.images().get(0);
        assertThat(img.width()).isEqualTo(8);
        assertThat(img.path()).isEqualTo("canvas");
        assertThat(Base64.getDecoder().decode(img.data())).isEqualTo(BYTES);
        assertThat(img.toString()).isEqualTo("Image");
        assertThat(out.summary()).doesNotContain(img.data());
    }

    @Test
    void theTraceIsEndedAfterEveryRunSoNothingLeaksToTheNextCall() {
        LiveCheckRunner.run(USE_CASE, REQ, null, true);
        assertThat(LookupTrace.current().capturedImages()).isEmpty();
        assertThat(LookupTrace.current().images()).isEmpty();
    }

    @Test
    void theTraceIsEndedEvenWhenTheLookupThrows() {
        try {
            LiveCheckRunner.run(req -> { throw new IllegalStateException("x"); }, REQ, null, true);
        } catch (IllegalStateException expected) {
            // fine
        }
        assertThat(LookupTrace.current().capturedImages()).isEmpty();
    }
}
