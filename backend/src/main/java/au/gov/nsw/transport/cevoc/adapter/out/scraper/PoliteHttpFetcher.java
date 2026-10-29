package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.StringJoiner;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Sequential, rate-limited HTTP: one request at a time, a minimum gap between requests,
 * identifying User-Agent, connect and request timeouts, no redirects to other hosts, no retries.
 * The session cookie (JSF needs one) is held in memory only.
 */
public class PoliteHttpFetcher implements PageFetcher {

    private final CertificateScraperProperties props;
    private final HttpClient client;
    private final ReentrantLock lock = new ReentrantLock();
    private long lastRequestNanos;
    private boolean hasRequested;

    public PoliteHttpFetcher(CertificateScraperProperties props) {
        this.props = props;
        this.client = HttpClient.newBuilder()
                .connectTimeout(props.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ORIGINAL_SERVER))
                .build();
    }

    @Override
    public String get(String url) {
        return send(base(url).GET().build());
    }

    @Override
    public String postForm(String url, Map<String, String> fields) {
        StringJoiner body = new StringJoiner("&");
        fields.forEach((k, v) -> body.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "="
                + URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8)));
        return send(base(url).header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build());
    }

    private HttpRequest.Builder base(String url) {
        return HttpRequest.newBuilder(URI.create(url))
                .timeout(props.requestTimeout())
                .header("User-Agent", props.userAgent())
                .header("Accept", "text/html");
    }

    private String send(HttpRequest request) {
        lock.lock(); // no parallelism: callers queue here
        try {
            waitForSlot();
            try {
                HttpResponse<String> resp = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (resp.statusCode() / 100 != 2) {
                    throw new ScrapeException("Source returned HTTP " + resp.statusCode());
                }
                return resp.body();
            } catch (IOException e) {
                throw new ScrapeException("Source request failed: " + e.getClass().getSimpleName(), e);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ScrapeException("Interrupted", e);
            } finally {
                lastRequestNanos = System.nanoTime();
                hasRequested = true;
            }
        } finally {
            lock.unlock();
        }
    }

    private void waitForSlot() {
        if (!hasRequested) return;
        long waitNanos = props.minInterval().toNanos() - (System.nanoTime() - lastRequestNanos);
        if (waitNanos > 0) {
            try {
                Thread.sleep(Duration.ofNanos(waitNanos));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ScrapeException("Interrupted", e);
            }
        }
    }
}
