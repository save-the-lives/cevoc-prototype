package cevoc.adapter.out.revenuensw;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Map;

/**
 * The only thing the Revenue NSW HTTP adapter needs from the network: one request, one response. Tests supply a fake
 * with canned fictitious responses, so no test ever makes a live call. Response header names are lower case.
 */
public interface HttpTransport {

    record Request(String method, URI uri, Map<String, String> headers, String body) {
        @Override
        public String toString() {
            // Never print headers or body: they carry the notice number, the token and possibly the registration.
            return "Request[" + method + "]";
        }
    }

    record Response(int status, Map<String, String> headers, byte[] body) {
        public Response {
            headers = headers == null ? Map.of() : Map.copyOf(headers);
            body = body == null ? new byte[0] : body;
        }

        public String header(String name) {
            return headers.get(name.toLowerCase(java.util.Locale.ROOT));
        }

        @Override
        public String toString() {
            return "Response[" + status + "]";
        }
    }

    /** A connect or read timeout. */
    class TimeoutException extends IOException {
        public TimeoutException() {
            super("timeout");
        }
    }

    /** The body exceeded the cap given to {@link #send}. */
    class TooLargeException extends IOException {
        public TooLargeException() {
            super("response too large");
        }
    }

    /** Sends the request. Throws {@link TimeoutException} on a timeout and {@link TooLargeException} past {@code maxBodyBytes}. No redirects are followed. */
    Response send(Request request, long maxBodyBytes, Duration timeout) throws IOException, InterruptedException;
}
