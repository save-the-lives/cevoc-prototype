package au.gov.nsw.transport.cevoc.livecheck;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.concurrent.Semaphore;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Guards every /live-check/* request. Registered only when cevoc.live-check.enabled=true (see LiveCheckGuardConfig).
 * <ul>
 *   <li>No configured token: every path answers 404 (endpoints disabled).</li>
 *   <li>Header X-Live-Check-Token must equal the token, compared in constant time; otherwise 401.</li>
 *   <li>One lookup at a time: a second concurrent POST /live-check/lookup gets 429.</li>
 * </ul>
 * It never reads, logs or echoes request values. CORS preflight (OPTIONS) passes through untouched.
 */
public class LiveCheckGuard implements HandlerInterceptor {

    public static final String HEADER = "X-Live-Check-Token";
    private static final String HELD = LiveCheckGuard.class.getName() + ".held";

    private final byte[] expectedDigest; // null when no token is configured
    private final Semaphore oneAtATime = new Semaphore(1);

    public LiveCheckGuard(String token) {
        this.expectedDigest = token == null || token.isBlank() ? null : sha256(token);
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (expectedDigest == null) {
            response.sendError(HttpServletResponse.SC_NOT_FOUND);
            return false;
        }
        String presented = request.getHeader(HEADER);
        // Hash both sides so the compared arrays always have the same length, then compare in constant time.
        boolean ok = MessageDigest.isEqual(expectedDigest, sha256(presented == null ? "" : presented)) && presented != null;
        if (!ok) {
            response.sendError(HttpServletResponse.SC_UNAUTHORIZED);
            return false;
        }
        if ("POST".equalsIgnoreCase(request.getMethod()) && request.getRequestURI().endsWith("/lookup")) {
            if (!oneAtATime.tryAcquire()) {
                response.setHeader("Retry-After", "60");
                response.sendError(429);
                return false;
            }
            request.setAttribute(HELD, Boolean.TRUE);
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        if (request.getAttribute(HELD) != null) {
            request.removeAttribute(HELD);
            oneAtATime.release();
        }
    }

    private static byte[] sha256(String s) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
