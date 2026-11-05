package cevoc.adapter.out.revenuensw;

import java.io.IOException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** A scripted transport: the handler answers each request; every request is recorded for assertions. No network. */
final class FakeTransport implements HttpTransport {

    @FunctionalInterface
    interface Handler {
        Response answer(Request request) throws IOException;
    }

    record Seen(String method, String uri, Map<String, String> headers, String body) {}

    final List<Seen> seen = new ArrayList<>();
    private final Handler handler;

    FakeTransport(Handler handler) {
        this.handler = handler;
    }

    @Override
    public Response send(Request r, long maxBodyBytes, Duration timeout) throws IOException {
        seen.add(new Seen(r.method(), r.uri().toString(), Map.copyOf(r.headers()), r.body()));
        return handler.answer(r);
    }

    static Response json(int status, String body) {
        return new Response(status, Map.of("content-type", "application/json"), body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    static Response json(int status, String body, Map<String, String> extra) {
        java.util.HashMap<String, String> h = new java.util.HashMap<>(extra);
        h.put("content-type", "application/json");
        return new Response(status, h, body.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    static Response image(byte[] bytes) {
        return new Response(200, Map.of("content-type", "image/jpeg"), bytes);
    }

    static String resource(String name) {
        try (var in = FakeTransport.class.getResourceAsStream("/fixtures/revenuensw/" + name)) {
            return new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        } catch (IOException | NullPointerException e) {
            throw new IllegalStateException("missing fixture " + name, e);
        }
    }

    long count(String method, String uriEnd) {
        return seen.stream().filter(s -> s.method().equals(method) && s.uri().endsWith(uriEnd)).count();
    }
}
