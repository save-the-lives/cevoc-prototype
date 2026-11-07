package cevoc.adapter.out.revenuensw;

import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Circuit-breaker adapter: tries the plain HTTP route first and falls back to the Chromium route
 * on failure. After {@value FAILURE_THRESHOLD} failures within {@value FAILURE_WINDOW_MINUTES} minutes the breaker
 * opens: the adapter goes straight to Chromium for {@value OPEN_DURATION_MINUTES} minutes, then probes
 * HTTP again. All constants are hardcoded (no new settings).
 *
 * <p>Each switch is logged with a fixed-vocabulary cause token so the live-check summary can show
 * which route answered without echoing any request values.
 */
public class AdaptivePenaltyLookupAdapter implements PenaltyLookupPort {

    private static final Logger LOG = LoggerFactory.getLogger(AdaptivePenaltyLookupAdapter.class);

    /** Failures within this window trip the breaker. */
    static final int FAILURE_WINDOW_MINUTES = 5;
    /** Number of failures that trips the breaker. */
    static final int FAILURE_THRESHOLD = 3;
    /** How long the breaker stays open (go straight to Chromium). */
    static final int OPEN_DURATION_MINUTES = 10;

    private final PenaltyLookupPort httpAdapter;
    private final PenaltyLookupPort browserAdapter;
    private final Clock clock;

    // Circuit breaker state (all access is synchronized on `this`).
    private final AtomicInteger failureCount = new AtomicInteger();
    private final AtomicReference<Instant> windowStart = new AtomicReference<>(Instant.EPOCH);
    private final AtomicReference<Instant> openUntil = new AtomicReference<>(Instant.EPOCH);

    public AdaptivePenaltyLookupAdapter(PenaltyLookupPort httpAdapter, PenaltyLookupPort browserAdapter, Clock clock) {
        this.httpAdapter = httpAdapter;
        this.browserAdapter = browserAdapter;
        this.clock = clock;
    }

    public AdaptivePenaltyLookupAdapter(PenaltyLookupPort httpAdapter, PenaltyLookupPort browserAdapter) {
        this(httpAdapter, browserAdapter, Clock.systemUTC());
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        return find(request, LookupProgress.NONE);
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
        Instant now = clock.instant();

        if (isBreakerOpen(now)) {
            // Breaker is open: go straight to Chromium, but probe HTTP on the first call after the open window.
            if (now.isAfter(openUntil.get())) {
                // Probe: try HTTP once to see if it recovered.
                LOG.info("Penalty lookup route: adapter=http, cause=probe-after-open");
                return tryHttpWithFallback(request, progress, now);
            }
            LOG.info("Penalty lookup route: adapter=browser, cause=breaker-open");
            return browserAdapter.find(request, progress);
        }

        LOG.info("Penalty lookup route: adapter=http, cause=primary");
        return tryHttpWithFallback(request, progress, now);
    }

    private PenaltyLookupResult tryHttpWithFallback(PenaltyLookupRequest request, LookupProgress progress, Instant now) {
        PenaltyLookupResult result;
        try {
            result = httpAdapter.find(request, progress);
        } catch (RuntimeException e) {
            LOG.info("Penalty lookup route: adapter=browser, cause=http-exception");
            recordFailure(now);
            return browserAdapter.find(request, progress);
        }

        if (isFailure(result)) {
            LOG.info("Penalty lookup route: adapter=browser, cause=http-unavailable");
            recordFailure(now);
            return browserAdapter.find(request, progress);
        }

        // Success: reset the failure count.
        resetFailures();
        return result;
    }

    /** A result counts as a failure when the HTTP adapter could not reach or read the source. NOT_FOUND is not a failure. */
    private static boolean isFailure(PenaltyLookupResult result) {
        return result.status() == PenaltyLookupResult.Status.UNAVAILABLE
                || result.status() == PenaltyLookupResult.Status.LIVE_LOOKUP_OFF
                || result.status() == PenaltyLookupResult.Status.LIVE_LOOKUP_DISABLED;
    }

    private synchronized void recordFailure(Instant now) {
        Instant ws = windowStart.get();
        if (ws.plusSeconds(FAILURE_WINDOW_MINUTES * 60L).isBefore(now)) {
            // Window expired: start a new one.
            windowStart.set(now);
            failureCount.set(1);
        } else {
            int count = failureCount.incrementAndGet();
            if (count >= FAILURE_THRESHOLD) {
                openUntil.set(now.plusSeconds(OPEN_DURATION_MINUTES * 60L));
                LOG.info("Penalty lookup route: breaker=open, cause=threshold-reached");
                // Reset so the next window after re-close starts fresh.
                failureCount.set(0);
                windowStart.set(now);
            }
        }
    }

    private void resetFailures() {
        failureCount.set(0);
    }

    private boolean isBreakerOpen(Instant now) {
        Instant until = openUntil.get();
        // The breaker is "open" while now < openUntil (go to browser) OR when now just passed openUntil (probe).
        // We treat the open period as: now is before openUntil. After openUntil, tryHttpWithFallback probes.
        return !until.equals(Instant.EPOCH) && now.isBefore(until);
    }
}
