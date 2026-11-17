package cevoc.adapter.out.blur;

import cevoc.application.port.out.BlurPort.Result;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Runs the blur pipeline in the blur worker container (record 0036): POST the video to {@code <worker>/blur}, get the blurred
 * video back. The worker answers 422 when blurring failed; anything but a 200 with a video is a failure, so the raw video is
 * never shown (fail-closed, as in this container). The plate goes in a header for this one request and is not logged.
 */
public final class HttpBlurPipeline implements ProcessBlurAdapter.Pipeline {

    private static final Logger log = LoggerFactory.getLogger(HttpBlurPipeline.class);
    /** The worker may scale from zero (image pull, start) and then blur for about a minute. */
    private static final Duration TIMEOUT = Duration.ofMinutes(6);

    private final URI blurUri;
    private final HttpClient http;

    public HttpBlurPipeline(String workerUrl) {
        if (workerUrl == null || workerUrl.isBlank()) {
            throw new IllegalStateException("cevoc.blur.mode=http needs cevoc.blur.worker-url");
        }
        this.blurUri = URI.create(workerUrl.replaceAll("/+$", "") + "/blur");
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
    }

    @Override
    public Result run(byte[] videoBytes, String offendingPlate, String hash) {
        HttpRequest.Builder b = HttpRequest.newBuilder(blurUri).timeout(TIMEOUT)
                .header("Content-Type", "video/mp4")
                .POST(HttpRequest.BodyPublishers.ofByteArray(videoBytes));
        if (offendingPlate != null && !offendingPlate.isBlank()) {
            b.header("X-Keep-Plate", offendingPlate);
        }
        try {
            HttpResponse<byte[]> r = http.send(b.build(), HttpResponse.BodyHandlers.ofByteArray());
            String type = r.headers().firstValue("Content-Type").orElse("");
            if (r.statusCode() == 200 && type.startsWith("video/") && r.body().length > 0) {
                return Result.ok(r.body(), "video/mp4");
            }
            String why = new String(r.body(), java.nio.charset.StandardCharsets.UTF_8);
            log.warn("Blur worker answered {} for {}: {}", r.statusCode(), hash.substring(0, 12),
                    why.length() > 200 ? why.substring(0, 200) : why);
            return Result.failed("Blur worker answered " + r.statusCode());
        } catch (IOException e) {
            log.warn("Blur worker unreachable for {}: {}", hash.substring(0, 12), e.toString());
            return Result.failed("Blur worker unreachable");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Result.failed("Interrupted");
        }
    }
}
