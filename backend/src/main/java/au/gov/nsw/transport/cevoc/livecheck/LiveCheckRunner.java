package au.gov.nsw.transport.cevoc.livecheck;

import au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.RequestScopedRegistration;
import au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase;
import au.gov.nsw.transport.cevoc.domain.LookupTrace;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import java.util.Base64;
import java.util.List;

/**
 * Runs one owner live-check lookup with a step trace, and returns the redacted text summary plus (only when
 * asked) the captured images. Image bytes exist only inside this call and the response built from it: they are
 * not logged, stored or cached here, and the default text-only path never retains them.
 */
public final class LiveCheckRunner {

    private LiveCheckRunner() {}

    /** One captured image for the owner's browser: numbers plus base64 bytes. */
    public record Image(int width, int height, int renderedWidth, int renderedHeight, int naturalWidth, int naturalHeight,
                        long bytes, String path, String contentType, String data) {
        @Override
        public String toString() {
            return "Image";
        }
    }

    public record Outcome(String summary, List<Image> images) {}

    public static Outcome run(LookupPenaltyUseCase useCase, PenaltyLookupRequest request, String plate, boolean includeImages) {
        return run(useCase, request, plate, includeImages, () -> { }, () -> "");
    }

    /**
     * @param before runs on the calling thread just before the lookup (for example to request the network map)
     * @param suffix text appended to the summary after the lookup (redacted lines only)
     */
    public static Outcome run(LookupPenaltyUseCase useCase, PenaltyLookupRequest request, String plate, boolean includeImages,
                              Runnable before, java.util.function.Supplier<String> suffix) {
        LookupTrace.begin(includeImages);
        try {
            return RequestScopedRegistration.with(plate, () -> {
                LookupDiagnostic.clear();
                before.run();
                var result = useCase.lookup(request);
                String failure = LookupDiagnostic.take();
                LookupTrace trace = LookupTrace.current();
                String summary = LiveCheckSummary.of(result, failure, trace) + suffix.get();
                List<Image> images = trace.capturedImages().stream().map(c -> new Image(
                        c.size().width(), c.size().height(), c.size().renderedWidth(), c.size().renderedHeight(),
                        c.size().naturalWidth(), c.size().naturalHeight(), c.size().bytes(), c.size().path().label(),
                        c.contentType(), Base64.getEncoder().encodeToString(c.data()))).toList();
                return new Outcome(summary, images);
            });
        } finally {
            LookupTrace.end();
        }
    }
}
