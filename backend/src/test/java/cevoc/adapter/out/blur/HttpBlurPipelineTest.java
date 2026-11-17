package cevoc.adapter.out.blur;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.application.port.out.BlurPort.Result;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Record 0036: the blur worker's answer decides; anything but a 200 video is a failure (fail-closed). */
class HttpBlurPipelineTest {

    private HttpServer server;
    private final AtomicReference<String> plateSeen = new AtomicReference<>();

    private String start(int status, String type, byte[] body) throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/blur", ex -> {
            plateSeen.set(ex.getRequestHeaders().getFirst("X-Keep-Plate"));
            ex.getRequestBody().readAllBytes();
            ex.getResponseHeaders().add("Content-Type", type);
            ex.sendResponseHeaders(status, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort() + "/";
    }

    @AfterEach
    void stop() {
        if (server != null) server.stop(0);
    }

    @Test
    void aBlurredVideoFromTheWorkerIsTheResultAndTheOwnPlateIsSent() throws Exception {
        String url = start(200, "video/mp4", new byte[] {1, 2, 3});
        Result r = new HttpBlurPipeline(url).run(new byte[] {9}, "TST123", "0123456789abcdef");
        assertThat(r.success()).isTrue();
        assertThat(r.data()).containsExactly(1, 2, 3);
        assertThat(plateSeen.get()).isEqualTo("TST123");
    }

    @Test
    void aWorkerFailureIsAFailureNeverTheRawVideo() throws Exception {
        String url = start(422, "text/plain", "detect_plates.py failed (1)".getBytes());
        Result r = new HttpBlurPipeline(url).run(new byte[] {9}, null, "0123456789abcdef");
        assertThat(r.success()).isFalse();
        assertThat(r.data()).isNull();
        assertThat(plateSeen.get()).isNull();
    }

    @Test
    void anUnreachableWorkerIsAFailure() {
        Result r = new HttpBlurPipeline("http://127.0.0.1:1").run(new byte[] {9}, null, "0123456789abcdef");
        assertThat(r.success()).isFalse();
    }
}
