package cevoc.adapter.out.blur;

import cevoc.application.port.out.BlurPort;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Blur adapter that delegates to a standalone Python worker via a message queue (ADR 0027).
 *
 * <p>Flow:
 * <ol>
 *   <li>Write input video to the shared volume</li>
 *   <li>Push a blur request message to the request queue</li>
 *   <li>Return "processing" immediately (the frontend auto-retries)</li>
 *   <li>A background poller checks the completion queue and populates the cache</li>
 * </ol>
 *
 * <p>The shared volume ({@code /shared/blur-data/}) is mounted by both the backend
 * and the worker container. Video bytes travel through the filesystem, not the queue.
 *
 * <p>Activated by {@code cevoc.blur.mode=queue}. Falls back to {@link ProcessBlurAdapter}
 * when {@code cevoc.blur.mode=process} (default).
 */
public final class QueueBlurAdapter implements BlurPort {

    private static final Logger log = LoggerFactory.getLogger(QueueBlurAdapter.class);
    private static final Duration CACHE_TTL = Duration.ofMinutes(20);
    private static final long CACHE_MAX_BYTES = 96 * 1024 * 1024;

    private final Path sharedDir;
    private final QueueClient queueClient;
    private final Map<String, CachedEntry> cache = new ConcurrentHashMap<>();
    private final java.util.Set<String> pending = ConcurrentHashMap.newKeySet();
    private final Clock clock;

    public QueueBlurAdapter(Path sharedDir, QueueClient queueClient) {
        this(sharedDir, queueClient, Clock.systemUTC());
    }

    QueueBlurAdapter(Path sharedDir, QueueClient queueClient, Clock clock) {
        this.sharedDir = sharedDir;
        this.queueClient = queueClient;
        this.clock = clock;
        startCompletionPoller();
    }

    @Override
    public Result blurVideo(byte[] videoBytes, String offendingPlate) {
        String hash = sha256(videoBytes) + "-" + (offendingPlate != null ? offendingPlate : "NONE");
        evictExpired();

        // Check cache
        CachedEntry cached = cache.get(hash);
        if (cached != null && cached.expiresAt.isAfter(clock.instant())) {
            log.info("Queue blur cache hit for {}", hash.substring(0, 12));
            return cached.result;
        }
        if (cached != null) cache.remove(hash);

        // Already submitted?
        if (!pending.add(hash)) {
            log.info("Blur request already pending for {}", hash.substring(0, 12));
            return Result.failed("Blur processing — try again shortly");
        }

        // Write input to shared volume
        try {
            Files.createDirectories(sharedDir);
            Path inputPath = sharedDir.resolve("input-" + hash.substring(0, 16) + ".mp4");
            Path outputPath = sharedDir.resolve("blurred-" + hash.substring(0, 16) + ".mp4");
            Files.write(inputPath, videoBytes);

            // Push request to queue
            String requestId = UUID.randomUUID().toString();
            String message = """
                    {"id":"%s","videoHash":"%s","inputPath":"%s","outputPath":"%s","offendingPlate":"%s","timestamp":"%s"}"""
                    .formatted(requestId, hash, inputPath, outputPath,
                            offendingPlate != null ? offendingPlate : "",
                            clock.instant().toString());
            queueClient.pushRequest(message);

            log.info("Blur request queued: {} -> {}", hash.substring(0, 12), requestId);
        } catch (IOException e) {
            pending.remove(hash);
            log.error("Failed to write input for blur request {}", hash.substring(0, 12), e);
            return Result.failed("IO error: " + e.getMessage());
        }

        return Result.failed("Blur processing — try again shortly");
    }

    @Override
    public Result blurImage(byte[] imageBytes, String offendingPlate) {
        // Image blurring: pass through for MVP (same as ProcessBlurAdapter)
        return Result.ok(imageBytes, "image/jpeg");
    }

    /**
     * Background thread that polls the completion queue and populates the cache.
     */
    private void startCompletionPoller() {
        Thread.startVirtualThread(() -> {
            log.info("Queue blur completion poller started");
            while (true) {
                try {
                    String completion = queueClient.pullCompletion(5);
                    if (completion == null) continue;

                    // Parse completion JSON (simple manual parse to avoid Jackson dependency)
                    String videoHash = extractJsonField(completion, "videoHash");
                    String status = extractJsonField(completion, "status");
                    String outputPath = extractJsonField(completion, "outputPath");

                    if ("ok".equals(status) && outputPath != null) {
                        Path output = Path.of(outputPath);
                        if (Files.exists(output) && Files.size(output) > 0) {
                            byte[] blurred = Files.readAllBytes(output);
                            evictIfOverSize(blurred.length);
                            cache.put(videoHash, new CachedEntry(
                                    Result.ok(blurred, "video/mp4"),
                                    clock.instant().plus(CACHE_TTL),
                                    blurred.length));
                            log.info("Blur complete from worker: {} ({} bytes)",
                                    videoHash.substring(0, 12), blurred.length);
                            // Clean up shared files
                            Files.deleteIfExists(output);
                        }
                    } else {
                        log.warn("Blur worker reported failure for {}: {}",
                                videoHash != null ? videoHash.substring(0, 12) : "?",
                                extractJsonField(completion, "detail"));
                    }

                    if (videoHash != null) pending.remove(videoHash);

                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("Completion poller error", e);
                    try { Thread.sleep(2000); } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        break;
                    }
                }
            }
        });
    }

    /** Simple JSON field extraction without a JSON library. */
    private static String extractJsonField(String json, String field) {
        String key = "\"" + field + "\":\"";
        int start = json.indexOf(key);
        if (start < 0) return null;
        start += key.length();
        int end = json.indexOf("\"", start);
        return end > start ? json.substring(start, end) : null;
    }

    private static String sha256(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    private record CachedEntry(Result result, Instant expiresAt, long sizeBytes) {}

    private void evictExpired() {
        Instant now = clock.instant();
        cache.entrySet().removeIf(e -> e.getValue().expiresAt.isBefore(now));
    }

    private void evictIfOverSize(long incoming) {
        long total = cache.values().stream().mapToLong(CachedEntry::sizeBytes).sum() + incoming;
        if (total <= CACHE_MAX_BYTES) return;
        cache.entrySet().stream()
                .sorted(Map.Entry.comparingByValue(java.util.Comparator.comparing(CachedEntry::expiresAt)))
                .limit(Math.max(1, cache.size() / 2))
                .map(Map.Entry::getKey)
                .toList()
                .forEach(cache::remove);
    }

    /**
     * Thin interface to the queue — keeps QueueBlurAdapter testable without a real queue.
     * Implementations for Redis, SQS, Azure Storage Queue are in the worker's queue_adapter.py;
     * the Java side only needs push (request) and pull (completion).
     */
    public interface QueueClient {
        void pushRequest(String messageJson);
        /** Pull one completion message. Returns null if none available. Blocks up to timeoutS. */
        String pullCompletion(int timeoutS) throws InterruptedException;
    }
}
