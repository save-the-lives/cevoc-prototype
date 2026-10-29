package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.time.Duration;
import java.util.function.LongConsumer;
import java.util.function.LongSupplier;

/** Enforces a minimum gap between outgoing requests. Callers are serialised, so there is no parallelism. */
public final class RateLimiter {

    private final long minIntervalNanos;
    private final LongSupplier nanoClock;
    private final LongConsumer sleeperNanos;
    private long lastNanos;
    private boolean first = true;

    public RateLimiter(Duration minInterval, LongSupplier nanoClock, LongConsumer sleeperNanos) {
        this.minIntervalNanos = minInterval.toNanos();
        this.nanoClock = nanoClock;
        this.sleeperNanos = sleeperNanos;
    }

    public static RateLimiter system(Duration minInterval) {
        return new RateLimiter(minInterval, System::nanoTime, nanos -> {
            try {
                Thread.sleep(nanos / 1_000_000, (int) (nanos % 1_000_000));
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException("interrupted while rate limiting", e);
            }
        });
    }

    /** Blocks until a request is allowed, then records it. */
    public synchronized void acquire() {
        if (!first) {
            long wait = minIntervalNanos - (nanoClock.getAsLong() - lastNanos);
            if (wait > 0) {
                sleeperNanos.accept(wait);
            }
        }
        first = false;
        lastNanos = nanoClock.getAsLong();
    }
}
