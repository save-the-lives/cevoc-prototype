package cevoc.livecheck;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.concurrent.Semaphore;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Guards every /live-check/* request. Registered only when cevoc.live-check.enabled=true (see LiveCheckGuardConfig).
 * <ul>
 *   <li>There is no token: while live check is enabled the endpoints are open. When it is not enabled this guard and the
 *       controller do not exist at all, so every /live-check path answers 404.</li>
 *   <li>One lookup at a time: a second concurrent POST /live-check/lookup gets 429.</li>
 * </ul>
 * It never reads, logs or echoes request values. CORS preflight (OPTIONS) passes through untouched.
 */
public class LiveCheckGuard implements HandlerInterceptor {

    private static final String HELD = LiveCheckGuard.class.getName() + ".held";

    private final Semaphore oneAtATime = new Semaphore(1);

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
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
}
