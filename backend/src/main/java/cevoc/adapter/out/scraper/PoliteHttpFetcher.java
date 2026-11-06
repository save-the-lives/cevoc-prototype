package cevoc.adapter.out.scraper;

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

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(PoliteHttpFetcher.class);

    private final CertificateScraperProperties props;
    private final HttpClient client;
    private final ReentrantLock lock = new ReentrantLock();
    private long lastRequestNanos;
    private boolean hasRequested;
    private final boolean browserHeaders;
    private String lastPageUrl;

    public PoliteHttpFetcher(CertificateScraperProperties props) {
        this(props, false);
    }

    /** {@code browserHeaders}: send the headers of a desktop Chrome navigation instead of the identifying agent ({@link BrowserHeaders}). */
    public PoliteHttpFetcher(CertificateScraperProperties props, boolean browserHeaders) {
        this.browserHeaders = browserHeaders;
        this.props = props;
        this.client = HttpClient.newBuilder()
                .connectTimeout(props.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .cookieHandler(new CookieManager(null, CookiePolicy.ACCEPT_ORIGINAL_SERVER))
                .build();
    }

    /** Puts cookies from an earlier browser visit into this fetcher's in-memory jar (host-only, for {@code pageUrl}'s host). */
    public PoliteHttpFetcher withCookies(String pageUrl, java.util.List<SessionCookies.Cookie> cookies) {
        URI uri = URI.create(pageUrl);
        CookieManager cm = (CookieManager) client.cookieHandler().orElseThrow();
        for (SessionCookies.Cookie c : cookies) {
            java.net.HttpCookie hc = new java.net.HttpCookie(c.name(), c.value());
            hc.setPath(c.path() == null || c.path().isBlank() ? "/" : c.path());
            hc.setSecure(true);
            cm.getCookieStore().add(uri, hc);
        }
        return this;
    }

    @Override
    public String get(String url) {
        lastPageUrl = url;
        return send("GET", base(url, browserHeaders ? BrowserHeaders.forGet() : null).GET().build());
    }

    @Override
    public String postForm(String url, Map<String, String> fields) {
        StringJoiner body = new StringJoiner("&");
        fields.forEach((k, v) -> body.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "="
                + URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8)));
        return send("POST", base(url, browserHeaders ? BrowserHeaders.forFormPost(lastPageUrl == null ? url : lastPageUrl, url) : null)
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString())).build());
    }

    private HttpRequest.Builder base(String url, Map<String, String> headers) {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(url)).timeout(props.requestTimeout());
        if (headers == null) {
            return b.header("User-Agent", props.userAgent()).header("Accept", "text/html");
        }
        headers.forEach(b::header);
        return b;
    }

    private String send(String method, HttpRequest request) {
        lock.lock(); // no parallelism: callers queue here
        try {
            waitForSlot();
            long started = System.nanoTime();
            try {
                HttpResponse<String> resp = client.send(request, HttpResponse.BodyHandlers.ofString());
                int code = resp.statusCode();
                // Method, status and timing only: never the URL's query, a header value or the body.
                LOG.info("Certificate HTTP request: method={}, status={}, ms={}, browser-headers={}", method, code,
                        (System.nanoTime() - started) / 1_000_000, browserHeaders);
                if (code == 401 || code == 403 || code == 429) {
                    // A refusal ends the attempt; callers must not retry or go another way round.
                    throw new ScrapeException("blocked-" + code);
                }
                if (code / 100 != 2) {
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
