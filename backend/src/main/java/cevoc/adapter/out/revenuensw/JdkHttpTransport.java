package cevoc.adapter.out.revenuensw;

import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

/** {@link HttpTransport} on the JDK HTTP client: no extra dependency, no cookie store, no redirects, no proxy tricks. */
public final class JdkHttpTransport implements HttpTransport {

    private final HttpClient client;

    public JdkHttpTransport(Duration connectTimeout) {
        this.client = HttpClient.newBuilder().connectTimeout(connectTimeout).followRedirects(HttpClient.Redirect.NEVER)
                .version(HttpClient.Version.HTTP_1_1).build();
    }

    @Override
    public Response send(Request r, long maxBodyBytes, Duration timeout) throws IOException, InterruptedException {
        HttpRequest.Builder b = HttpRequest.newBuilder(r.uri()).timeout(timeout);
        r.headers().forEach(b::header);
        if (r.body() == null) {
            b.method(r.method(), HttpRequest.BodyPublishers.noBody());
        } else {
            b.method(r.method(), HttpRequest.BodyPublishers.ofString(r.body()));
        }
        try {
            HttpResponse<InputStream> resp = client.send(b.build(), HttpResponse.BodyHandlers.ofInputStream());
            try (InputStream in = resp.body()) {
                byte[] body = readCapped(in, maxBodyBytes);
                Map<String, String> headers = new HashMap<>();
                resp.headers().map().forEach((k, v) -> {
                    if (!v.isEmpty()) {
                        headers.put(k.toLowerCase(java.util.Locale.ROOT), v.get(0));
                    }
                });
                return new Response(resp.statusCode(), headers, body);
            }
        } catch (HttpTimeoutException | java.net.SocketTimeoutException e) {
            throw new TimeoutException();
        }
    }

    private static byte[] readCapped(InputStream in, long max) throws IOException {
        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[16 * 1024];
        long total = 0;
        int n;
        while ((n = in.read(buf)) != -1) {
            total += n;
            if (total > max) {
                throw new TooLargeException();
            }
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }
}
