package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.StringJoiner;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Sequential, rate limited, time limited, size limited GET with an identifying User-Agent.
 * Never follows redirects (the caller decides), never sends cookies or credentials.
 */
public class EvidencePoliteHttpFetcher implements EvidencePageFetcher {

    private final HttpClient client;
    private final String userAgent;
    private final Duration requestTimeout;
    private final long maxBytes;
    private final EvidenceRateLimiter limiter;

    public EvidencePoliteHttpFetcher(HttpClient client, String userAgent, Duration requestTimeout, long maxBytes, EvidenceRateLimiter limiter) {
        this.client = client;
        this.userAgent = userAgent;
        this.requestTimeout = requestTimeout;
        this.maxBytes = maxBytes;
        this.limiter = limiter;
    }

    @Override
    public synchronized Response get(URI uri) throws IOException, InterruptedException {
        return send(HttpRequest.newBuilder(uri)
                .timeout(requestTimeout)
                .header("User-Agent", userAgent)
                .header("Accept", "text/html,image/*,video/*;q=0.8")
                .GET()
                .build());
    }

    /** The form values are used only to build the request body; they are never logged or kept. */
    @Override
    public synchronized Response post(URI uri, Map<String, String> form) throws IOException, InterruptedException {
        StringJoiner body = new StringJoiner("&");
        for (Map.Entry<String, String> e : form.entrySet()) {
            body.add(URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "="
                    + URLEncoder.encode(e.getValue() == null ? "" : e.getValue(), StandardCharsets.UTF_8));
        }
        return send(HttpRequest.newBuilder(uri)
                .timeout(requestTimeout)
                .header("User-Agent", userAgent)
                .header("Accept", "text/html")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()))
                .build());
    }

    private Response send(HttpRequest request) throws IOException, InterruptedException {
        limiter.acquire();
        HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());
        try (InputStream in = response.body()) {
            byte[] body = in.readNBytes((int) Math.min(maxBytes + 1, Integer.MAX_VALUE - 8));
            if (body.length > maxBytes) {
                throw new IOException("response larger than the configured limit");
            }
            return new Response(response.statusCode(),
                    response.headers().firstValue("Content-Type").orElse(""), body);
        }
    }
}
