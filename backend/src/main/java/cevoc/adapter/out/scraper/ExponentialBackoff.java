package cevoc.adapter.out.scraper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * Simple exponential back-off circuit breaker for a certificate provider. When a provider is blocked, it is skipped
 * for a window that starts at {@code initialWindow} and doubles on each successive block (capped at {@code maxWindow}).
 * A successful lookup resets the back-off entirely. Thread-safe.
 */
final class ExponentialBackoff {

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(ExponentialBackoff.class);

    private final String providerName;
    private final Duration initialWindow;
    private final Duration maxWindow;
    private final Clock clock;

    private Instant blockedUntil;      // null when not in back-off
    private Duration currentWindow;    // null when not in back-off

    ExponentialBackoff(String providerName, Duration initialWindow, Duration maxWindow, Clock clock) {
        this.providerName = providerName;
        this.initialWindow = initialWindow;
        this.maxWindow = maxWindow;
        this.clock = clock;
    }

    /** Default: 24-hour initial window, 7-day cap. */
    ExponentialBackoff(String providerName, Clock clock) {
        this(providerName, Duration.ofHours(24), Duration.ofDays(7), clock);
    }

    /** True when the provider should be skipped (within the back-off window). */
    synchronized boolean shouldSkip() {
        if (blockedUntil == null) return false;
        if (clock.instant().isBefore(blockedUntil)) {
            LOG.debug("Backoff skip: provider={}, until={}", providerName, blockedUntil);
            return true;
        }
        // Window expired — allow the next attempt (don't reset yet; recordSuccess or recordBlock will).
        return false;
    }

    /** Record a block: set or double the back-off window. */
    synchronized void recordBlock() {
        Instant now = clock.instant();
        if (currentWindow == null) {
            currentWindow = initialWindow;
        } else {
            currentWindow = currentWindow.multipliedBy(2);
            if (currentWindow.compareTo(maxWindow) > 0) {
                currentWindow = maxWindow;
            }
        }
        blockedUntil = now.plus(currentWindow);
        LOG.warn("Backoff block: provider={}, window={}, until={}", providerName, currentWindow, blockedUntil);
    }

    /** A successful lookup resets the back-off entirely. */
    synchronized void recordSuccess() {
        if (currentWindow != null) {
            LOG.info("Backoff reset: provider={}", providerName);
        }
        blockedUntil = null;
        currentWindow = null;
    }
}
