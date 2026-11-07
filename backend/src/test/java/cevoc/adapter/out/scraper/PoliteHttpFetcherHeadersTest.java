package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** The fetcher against a local loopback server (no outside network): which headers go out, and what a refusal does. */
class PoliteHttpFetcherHeadersTest {

    private HttpServer server;
    private String base;
    private final List<com.sun.net.httpserver.Headers> seen = new CopyOnWriteArrayList<>();
    private volatile int status = 200;

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", ex -> {
            seen.add(ex.getRequestHeaders());
            byte[] body = "<html></html>".getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(status, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        server.start();
        base = "http://127.0.0.1:" + server.getAddress().getPort() + "/search.jsf";
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private CertificateScraperProperties props() {
        return new CertificateScraperProperties(base, "CEVOC/1.0 (contact: test@example.invalid)", Duration.ofSeconds(2),
                Duration.ofSeconds(2), Duration.ofSeconds(5), Duration.ofSeconds(60), CertificateKeyStrategy.VIA_ENFORCEMENT_SITE);
    }

    @Test
    void browserHeadersGoOutOnGetAndPost() {
        PoliteHttpFetcher f = new PoliteHttpFetcher(props(), true);
        f.get(base);
        f.postForm(base, Map.of("a", "b"));
        var get = seen.get(0);
        assertThat(get.getFirst("User-Agent")).contains("Chrome/").doesNotContain("cevoc");
        assertThat(get.getFirst("Sec-Fetch-Site")).isEqualTo("none");
        assertThat(get.getFirst("Accept-Language")).isEqualTo("en-AU,en;q=0.9");
        assertThat(get.getFirst("Referer")).isNull();
        var post = seen.get(1);
        assertThat(post.getFirst("Sec-Fetch-Site")).isEqualTo("same-origin");
        assertThat(post.getFirst("Referer")).isEqualTo(base);
        assertThat(post.getFirst("Origin")).startsWith("http://127.0.0.1:");
        assertThat(post.getFirst("Content-Type")).isEqualTo("application/x-www-form-urlencoded");
    }

    @Test
    void theDefaultFetcherStillIdentifiesItself() {
        new PoliteHttpFetcher(props()).get(base);
        assertThat(seen.get(0).getFirst("User-Agent")).contains("CEVOC/1.0");
        assertThat(seen.get(0).getFirst("Sec-Fetch-Mode")).isNull();
    }

    @Test
    void gzipBodyIsInflatedAndAllowListedResponseCookiesAreReported() throws Exception {
        server.removeContext("/");
        server.createContext("/", ex -> {
            seen.add(ex.getRequestHeaders());
            var bos = new java.io.ByteArrayOutputStream();
            try (var gz = new java.util.zip.GZIPOutputStream(bos)) {
                gz.write("<html>zipped</html>".getBytes(StandardCharsets.UTF_8));
            }
            byte[] body = bos.toByteArray();
            ex.getResponseHeaders().add("Content-Encoding", "gzip");
            ex.getResponseHeaders().add("Set-Cookie", "JSESSIONID=fictitious-s; Path=/");
            ex.getResponseHeaders().add("Set-Cookie", "ak_bmsc=fictitious-a; Path=/");
            ex.getResponseHeaders().add("Set-Cookie", "other=fictitious-o; Path=/");
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        var got = new java.util.concurrent.atomic.AtomicReference<List<SessionCookies.Cookie>>();
        String html = new PoliteHttpFetcher(props(), true, got::set).get(base);
        assertThat(html).isEqualTo("<html>zipped</html>");
        assertThat(seen.get(0).getFirst("Accept-Encoding")).isEqualTo("gzip");
        assertThat(got.get()).extracting(SessionCookies.Cookie::name).containsExactlyInAnyOrder("JSESSIONID", "ak_bmsc");
    }

    @Test
    void a403IsARefusalAndIsNotRetried() {
        status = 403;
        assertThatThrownBy(() -> new PoliteHttpFetcher(props(), true).get(base)).hasMessage("blocked-403");
        assertThat(seen).hasSize(1);
    }
}
