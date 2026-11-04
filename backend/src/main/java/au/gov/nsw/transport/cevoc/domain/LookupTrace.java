package au.gov.nsw.transport.cevoc.domain;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Ordered, fixed-vocabulary record of one lookup: per {@link LookupStep} an outcome, a duration and, for failed or
 * skipped steps, a whitelisted {@link StepCause}. It holds no page text and no value the caller typed. Adapters
 * report against it through {@link #current()}; with no trace begun on the thread that is an inert object, so
 * ordinary requests record nothing. The owner's live check begins one per call and always ends it.
 *
 * <p>Captured image bytes are kept only when the trace was begun with {@code retainImageBytes}; they live as long
 * as the trace (one call) and are never written anywhere by this class.
 */
public final class LookupTrace {

    /** A step as recorded. */
    public record Entry(LookupStep step, StepOutcome outcome, long millis, StepCause cause) {}

    /** Image bytes retained for the owner's response. */
    public record Captured(ImageSize size, String contentType, byte[] data) {
        @Override
        public String toString() {
            return "Captured";
        }
    }

    @FunctionalInterface
    public interface Work<T, E extends Exception> {
        T run() throws E;
    }

    private static final ThreadLocal<LookupTrace> CURRENT = new ThreadLocal<>();
    private static final LookupTrace INERT = new LookupTrace(false, false);

    private final boolean recording;
    private final boolean retainImageBytes;
    private final Map<LookupStep, Entry> entries = new EnumMap<>(LookupStep.class);
    private final List<ImageSize> images = new ArrayList<>();
    private final List<Captured> captured = new ArrayList<>();

    private LookupTrace(boolean recording, boolean retainImageBytes) {
        this.recording = recording;
        this.retainImageBytes = retainImageBytes;
    }

    /** Starts a trace on this thread (replacing any earlier one). Pair with {@link #end()} in a finally block. */
    public static LookupTrace begin(boolean retainImageBytes) {
        LookupTrace t = new LookupTrace(true, retainImageBytes);
        CURRENT.set(t);
        return t;
    }

    /** Stops tracing on this thread and returns the trace (or an empty one if none was begun). */
    public static LookupTrace end() {
        LookupTrace t = CURRENT.get();
        CURRENT.remove();
        return t == null ? new LookupTrace(true, false) : t;
    }

    /** The trace of this thread, or an inert one that ignores everything. */
    public static LookupTrace current() {
        LookupTrace t = CURRENT.get();
        return t == null ? INERT : t;
    }

    public boolean retainsImageBytes() {
        return recording && retainImageBytes;
    }

    /** Runs the work, records ok with its duration, or failed (cause mapped from the exception) and rethrows. */
    public <T, E extends Exception> T run(LookupStep step, Work<T, E> work) throws E {
        long start = System.nanoTime();
        try {
            T out = work.run();
            put(step, StepOutcome.OK, since(start), null);
            return out;
        } catch (Exception e) {
            put(step, StepOutcome.FAILED, since(start), StepCause.of(e));
            throw e;
        }
    }

    /** Records the step as ok with a measured duration (for a stage timed by the caller). */
    public void ok(LookupStep step, long millis) {
        put(step, StepOutcome.OK, millis, null);
    }

    /** Marks the step failed with the given cause, keeping an already measured duration. */
    public void fail(LookupStep step, StepCause cause) {
        Entry e = entries.get(step);
        put(step, StepOutcome.FAILED, e == null ? 0 : e.millis(), cause);
    }

    /** Whether a step already has a recorded outcome. */
    public boolean has(LookupStep step) {
        return entries.containsKey(step);
    }

    public void skip(LookupStep step, StepCause cause) {
        put(step, StepOutcome.SKIPPED, 0, cause);
    }

    /** Records one captured image (numbers) and, when asked to retain, its bytes. */
    public void image(ImageSize size, String contentType, byte[] data) {
        if (!recording || images.size() >= 40) {
            return;
        }
        images.add(size);
        if (retainImageBytes && data != null) {
            captured.add(new Captured(size, contentType, data));
        }
    }

    public List<ImageSize> images() {
        return List.copyOf(images);
    }

    public List<Captured> capturedImages() {
        return List.copyOf(captured);
    }

    /**
     * Every step of the vocabulary in order. Steps never recorded show as skipped: "prior-failure" when an earlier
     * step failed, otherwise "not-applicable".
     */
    public List<Entry> entries() {
        boolean failed = firstFailed() != null;
        List<Entry> out = new ArrayList<>();
        for (LookupStep s : LookupStep.values()) {
            Entry e = entries.get(s);
            if (e == null) {
                boolean anyEarlierFailed = false;
                for (LookupStep p : LookupStep.values()) {
                    if (p.ordinal() < s.ordinal() && entries.get(p) != null && entries.get(p).outcome() == StepOutcome.FAILED) {
                        anyEarlierFailed = true;
                    }
                }
                e = new Entry(s, StepOutcome.SKIPPED, 0, anyEarlierFailed && failed ? StepCause.PRIOR_FAILURE : StepCause.NOT_APPLICABLE);
            }
            out.add(e);
        }
        return out;
    }

    public Entry firstFailed() {
        for (LookupStep s : LookupStep.values()) {
            Entry e = entries.get(s);
            if (e != null && e.outcome() == StepOutcome.FAILED) {
                return e;
            }
        }
        return null;
    }

    private void put(LookupStep step, StepOutcome outcome, long millis, StepCause cause) {
        if (recording) {
            entries.put(step, new Entry(step, outcome, Math.max(0, millis), cause));
        }
    }

    private static long since(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }
}
