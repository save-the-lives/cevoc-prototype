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
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Blur adapter that calls the Python blur pipeline as a subprocess (ADR 0017).
 * Steps: detect faces (YuNet) → detect plates (contour + OCR) → merge → render.
 * Caches by content hash with a 20-minute TTL (aligned with evidence link expiry)
 * and a 96 MB size bound. Fail-closed: any subprocess failure means the video is not released.
 */
public final class ProcessBlurAdapter implements BlurPort {

    private static final Logger log = LoggerFactory.getLogger(ProcessBlurAdapter.class);
    private static final long TIMEOUT_SECONDS = 120;
    /** Cache TTL aligned with evidence link expiry in InMemoryMediaAdapter. */
    private static final Duration CACHE_TTL = Duration.ofMinutes(20);
    /** Max total cached bytes (same as InMemoryMediaAdapter default). */
    private static final long CACHE_MAX_BYTES = 96 * 1024 * 1024;

    private final Path scriptsDir;
    private final Map<String, CachedEntry> cache = new ConcurrentHashMap<>();
    /** Tracks hashes currently being processed in the background to avoid duplicate work. */
    private final java.util.Set<String> processing = ConcurrentHashMap.newKeySet();
    private final Clock clock;

    public ProcessBlurAdapter(Path scriptsDir) {
        this(scriptsDir, Clock.systemUTC());
    }

    ProcessBlurAdapter(Path scriptsDir, Clock clock) {
        this.scriptsDir = scriptsDir;
        this.clock = clock;
    }

    @Override
    public Result blurVideo(byte[] videoBytes, String offendingPlate) {
        String hash = sha256(videoBytes) + "-" + (offendingPlate != null ? offendingPlate : "NONE");
        evictExpired();
        CachedEntry cached = cache.get(hash);
        if (cached != null && cached.expiresAt.isAfter(clock.instant())) {
            log.info("Blur cache hit for video hash {}", hash.substring(0, 12));
            return cached.result;
        }
        if (cached != null) {
            cache.remove(hash); // expired
        }

        // Blur is CPU-intensive (face detect + plate detect + merge + render). Run it in the background
        // and return "processing" immediately — the frontend auto-retries every 5 seconds.
        if (processing.add(hash)) {
            log.info("Starting async blur for video hash {} ({} bytes)", hash.substring(0, 12), videoBytes.length);
            Thread.startVirtualThread(() -> {
                try {
                    Result result = blurSync(videoBytes, offendingPlate, hash);
                    if (result.success()) {
                        evictIfOverSize(result.data().length);
                        cache.put(hash, new CachedEntry(result, clock.instant().plus(CACHE_TTL), result.data().length));
                        log.info("Async blur done: {} -> {} bytes, cached as {} (TTL {}min)",
                                videoBytes.length, result.data().length, hash.substring(0, 12), CACHE_TTL.toMinutes());
                    } else {
                        log.warn("Async blur failed for {}: {}", hash.substring(0, 12), result.detail());
                    }
                } finally {
                    processing.remove(hash);
                }
            });
        } else {
            log.info("Blur already in progress for hash {}", hash.substring(0, 12));
        }
        return Result.failed("Blur processing — try again shortly");
    }

    private Result blurSync(byte[] videoBytes, String offendingPlate, String hash) {
        try {
            Path tmpDir = Files.createTempDirectory("blur-");
            Path input = tmpDir.resolve("input.mp4");
            Path faceRegions = tmpDir.resolve("face-regions.json");
            Path plateRegions = tmpDir.resolve("plate-regions.json");
            Path mergedRegions = tmpDir.resolve("merged-regions.json");
            Path output = tmpDir.resolve("blurred.mp4");

            Files.write(input, videoBytes);

            // Step 1: Detect faces
            if (!runScript("detect_faces.py", input.toString(), "--output", faceRegions.toString())) {
                cleanup(tmpDir);
                return Result.failed("Face detection failed");
            }

            // Step 2: Detect plates
            String[] plateArgs = offendingPlate != null
                    ? new String[]{"detect_plates.py", input.toString(), "--offending", offendingPlate, "--output", plateRegions.toString()}
                    : new String[]{"detect_plates.py", input.toString(), "--output", plateRegions.toString()};
            if (!runScript(plateArgs)) {
                cleanup(tmpDir);
                return Result.failed("Plate detection failed");
            }

            // Step 3: Merge region tracks
            if (!runScript("merge_tracks.py", faceRegions.toString(), plateRegions.toString(), "--output", mergedRegions.toString())) {
                cleanup(tmpDir);
                return Result.failed("Track merge failed");
            }

            // Step 4: Render blurred video
            if (!runScript("render_blur.py", input.toString(), mergedRegions.toString(), "--output", output.toString())) {
                cleanup(tmpDir);
                return Result.failed("Blur rendering failed");
            }

            if (!Files.exists(output) || Files.size(output) == 0) {
                cleanup(tmpDir);
                return Result.failed("Blur output is empty");
            }

            byte[] blurred = Files.readAllBytes(output);
            cleanup(tmpDir);
            return Result.ok(blurred, "video/mp4");

        } catch (IOException e) {
            log.error("Blur processing failed for {}", hash.substring(0, 12), e);
            return Result.failed("IO error: " + e.getMessage());
        }
    }

    @Override
    public Result blurImage(byte[] imageBytes, String offendingPlate) {
        // Image blurring follows the same pattern but with a single-frame pipeline.
        // For MVP, images are not blurred server-side (they come from the demo SVG generator
        // or from Revenue NSW which already controls access). Return as-is.
        return Result.ok(imageBytes, "image/jpeg");
    }

    private boolean runScript(String... args) {
        String[] cmd = new String[args.length + 2];
        cmd[0] = "python3";
        cmd[1] = "-I";
        for (int i = 0; i < args.length; i++) {
            // If the arg looks like a script name (no path separator), prepend scriptsDir
            if (i == 0 && !args[i].contains("/")) {
                cmd[i + 2] = scriptsDir.resolve(args[i]).toString();
            } else {
                cmd[i + 2] = args[i];
            }
        }
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            pb.environment().put("PYTHONDONTWRITEBYTECODE", "1");
            Process p = pb.start();

            // Stream output line-by-line in real time so logs show what the script
            // is doing even if it hangs. The old code called readAllBytes() which
            // blocked until the process closed stdout — the timeout never triggered.
            Thread outputDrainer = Thread.startVirtualThread(() -> {
                try (var reader = new java.io.BufferedReader(
                        new java.io.InputStreamReader(p.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.info("[blur:{}] {}", args[0], line);
                    }
                } catch (IOException ignored) {
                    // process destroyed — expected on timeout
                }
            });

            boolean finished = p.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                log.warn("Blur script {} timed out after {}s — killing", args[0], TIMEOUT_SECONDS);
                p.destroyForcibly();
                outputDrainer.interrupt();
                return false;
            }
            outputDrainer.join(5_000); // let drainer finish reading last output
            boolean ok = p.exitValue() == 0;
            if (!ok) {
                log.warn("Blur script {} exited with code {}", args[0], p.exitValue());
            }
            return ok;
        } catch (IOException | InterruptedException e) {
            log.error("Failed to run blur script {}", args[0], e);
            return false;
        }
    }

    private static void cleanup(Path dir) {
        try {
            Files.walk(dir).sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) {}
            });
        } catch (IOException ignored) {}
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
        // Evict oldest entries until under budget
        cache.entrySet().stream()
                .sorted(Map.Entry.comparingByValue(java.util.Comparator.comparing(CachedEntry::expiresAt)))
                .limit(Math.max(1, cache.size() / 2))
                .map(Map.Entry::getKey)
                .toList()
                .forEach(cache::remove);
    }
}
