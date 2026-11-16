package cevoc.adapter.out.revenuensw;

import cevoc.adapter.out.scraper.LookupDiagnostic;
import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Cheapest route first (record 0030): the plain HTTP route, then the Chromium route. It adjusts itself to how the source
 * treats the cheap route:
 * <ul>
 *   <li><b>Refused</b> (401, 403, 429, a captcha, or an answer in a shape we cannot read), or <b>details without the
 *       images</b> because an image call failed: the cheap route is not accepted for the full answer, so it is skipped for
 *       {@link #REFUSED_SKIP} and every lookup goes straight to Chromium (this one included). After that one lookup tries it
 *       again.</li>
 *   <li><b>Not ready</b> (no service path yet): costs nothing, so it is just passed over; the first Chromium lookup learns
 *       the path ({@link LearnedServicePath}) and the next lookup uses HTTP.</li>
 *   <li><b>Transient</b> (timeout, network error, server error): {@value #FAILURE_THRESHOLD} within
 *       {@value #FAILURE_WINDOW_MINUTES} minutes skips HTTP for {@value #OPEN_DURATION_MINUTES} minutes.</li>
 * </ul>
 * A NOT_FOUND, INPUT_REQUIRED or FOUND answer is final: the next route is never asked the same question. Memory is in this
 * process only, so a restart starts again from the cheapest route. Each decision is logged with fixed tokens, no values.
 */
public class AdaptivePenaltyLookupAdapter implements PenaltyLookupPort {

    private static final Logger LOG = LoggerFactory.getLogger(AdaptivePenaltyLookupAdapter.class);

    /** How long a route the source refused is skipped. Owner direction 2026-11-17: about a day. */
    static final Duration REFUSED_SKIP = Duration.ofHours(24);
    static final int FAILURE_WINDOW_MINUTES = 5;
    static final int FAILURE_THRESHOLD = 3;
    static final int OPEN_DURATION_MINUTES = 10;

    /** Cause tokens that mean the source does not accept the cheap route (not a passing fault). */
    static final Set<String> REFUSAL_CAUSES = Set.of("blocked-401", "blocked-403", "blocked-429", "captcha", "bad-shape");
    private static final Pattern CAUSE = Pattern.compile("cause=([a-z0-9-]{1,30})");

    private final PenaltyLookupPort httpAdapter;
    private final PenaltyLookupPort browserAdapter;
    private final Clock clock;

    // All state is guarded by `this`.
    private int failureCount;
    private Instant windowStart = Instant.EPOCH;
    private Instant skipHttpUntil = Instant.EPOCH;
    private String skipReason = "";

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
        String skipping = skipping(now);
        if (skipping != null) {
            LOG.info("Penalty lookup route: adapter=browser, cause={}", skipping);
            return browserAdapter.find(request, progress);
        }

        LOG.info("Penalty lookup route: adapter=http, cause=cheapest-first");
        LookupDiagnostic.clear(); // the cause read below must come from this call, not an earlier lookup on this thread
        PenaltyLookupResult result;
        try {
            result = httpAdapter.find(request, progress);
        } catch (RuntimeException e) {
            transientFailure(now);
            LOG.info("Penalty lookup route: adapter=browser, cause=http-exception");
            return browserAdapter.find(request, progress);
        }

        switch (result.status()) {
            case FOUND -> {
                // The details came back but an image call failed (its cause is in the diagnostic): the cheap route gives a
                // worse answer than Chromium for this notice, so it does not count as accepted. A wrong registration is
                // reported without a cause token and stays final.
                String imageCause = causeToken(LookupDiagnostic.peek());
                if (result.evidence().isEmpty() && !"unavailable".equals(imageCause)) {
                    refused(now, "images-" + imageCause);
                    LOG.info("Penalty lookup route: adapter=browser, cause=http-images-{}", imageCause);
                    return browserAdapter.find(request, progress);
                }
                succeeded();
                return result;
            }
            case NOT_FOUND, INPUT_REQUIRED -> {
                succeeded();
                return result;
            }
            case LIVE_LOOKUP_OFF, LIVE_LOOKUP_DISABLED -> {
                LOG.info("Penalty lookup route: adapter=browser, cause=http-not-ready");
                return browserAdapter.find(request, progress);
            }
            default -> {
                String cause = causeToken(LookupDiagnostic.peek());
                if (REFUSAL_CAUSES.contains(cause)) {
                    refused(now, cause);
                } else {
                    transientFailure(now);
                }
                LOG.info("Penalty lookup route: adapter=browser, cause=http-{}", cause);
                return browserAdapter.find(request, progress);
            }
        }
    }

    /** The reason HTTP is being skipped now, or null when it should be tried. */
    private synchronized String skipping(Instant now) {
        return now.isBefore(skipHttpUntil) ? skipReason : null;
    }

    private synchronized void refused(Instant now, String cause) {
        skipHttpUntil = now.plus(REFUSED_SKIP);
        skipReason = "http-refused-remembered";
        failureCount = 0;
        LOG.info("Penalty lookup route: http refused (cause={}), skipped for {} hours", cause, REFUSED_SKIP.toHours());
    }

    private synchronized void transientFailure(Instant now) {
        if (windowStart.plusSeconds(FAILURE_WINDOW_MINUTES * 60L).isBefore(now)) {
            windowStart = now;
            failureCount = 1;
        } else {
            failureCount++;
        }
        if (failureCount >= FAILURE_THRESHOLD) {
            skipHttpUntil = now.plusSeconds(OPEN_DURATION_MINUTES * 60L);
            skipReason = "breaker-open";
            failureCount = 0;
            windowStart = now;
            LOG.info("Penalty lookup route: breaker=open, cause=threshold-reached");
        }
    }

    private synchronized void succeeded() {
        failureCount = 0;
    }

    static String causeToken(String diagnostic) {
        if (diagnostic == null) return "unavailable";
        Matcher m = CAUSE.matcher(diagnostic);
        return m.find() ? m.group(1) : "unavailable";
    }
}
