package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
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
        limiter.acquire();
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(requestTimeout)
                .header("User-Agent", userAgent)
                .header("Accept", "text/html,image/*,video/*;q=0.8")
                .GET()
                .build();
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
