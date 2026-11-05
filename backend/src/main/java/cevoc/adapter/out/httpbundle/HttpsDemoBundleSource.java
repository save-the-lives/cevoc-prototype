package cevoc.adapter.out.httpbundle;

import cevoc.application.port.out.DemoBundleSourcePort;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * The one adapter for {@link DemoBundleSourcePort}: a plain HTTPS GET, no credentials, no cookies, no headers beyond the
 * default. Only https is accepted, redirects are followed (a GitHub Release download redirects to its storage host), the
 * body is capped and the call has a connect and an overall timeout. Nothing about the host is known here.
 */
public final class HttpsDemoBundleSource implements DemoBundleSourcePort {

    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NORMAL).build();
    private final Duration timeout;

    public HttpsDemoBundleSource(Duration timeout) {
        this.timeout = timeout;
    }

    @Override
    public byte[] fetch(String location, long maxBytes) throws IOException {
        URI uri;
        try {
            uri = URI.create(location);
        } catch (IllegalArgumentException e) {
            throw new IOException("the bundle location is not a valid URL");
        }
        if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null) {
            throw new IOException("the bundle location must be a plain https URL without credentials");
        }
        try {
            HttpResponse<InputStream> res = client.send(HttpRequest.newBuilder(uri).timeout(timeout).GET().build(),
                    HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream in = res.body()) {
                if (res.statusCode() != 200) {
                    throw new IOException("the bundle location answered " + res.statusCode());
                }
                ByteArrayOutputStream out = new ByteArrayOutputStream();
                byte[] buf = new byte[16384];
                long total = 0;
                int n;
                while ((n = in.read(buf)) > 0) {
                    total += n;
                    if (total > maxBytes) {
                        throw new IOException("the bundle is larger than the allowed " + maxBytes + " bytes");
                    }
                    out.write(buf, 0, n);
                }
                return out.toByteArray();
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("the bundle download was interrupted");
        }
    }
}
