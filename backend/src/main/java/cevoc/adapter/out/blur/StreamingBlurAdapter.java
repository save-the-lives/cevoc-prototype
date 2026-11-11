package cevoc.adapter.out.blur;

import cevoc.application.port.out.BlurPort;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * HLS streaming blur adapter (ADR 0017). Splits a video into HLS segments, blurs each independently,
 * and serves an m3u8 manifest + segments. The client starts playing segment 1 while segment 2 is still
 * being blurred — no wait for the full file.
 *
 * <p><strong>Not enabled by default.</strong> The default is {@link ProcessBlurAdapter} (full-file blur).
 * To switch, change the {@code blurPort} bean in {@code DemoDataConfig} to return a {@code StreamingBlurAdapter}
 * instead, or set {@code cevoc.blur.streaming=true} once wired.</p>
 *
 * <p>Flow:
 * <ol>
 *   <li>Write raw video to a temp dir</li>
 *   <li>Split into 2-second HLS segments with FFmpeg</li>
 *   <li>Detect faces + plates once on the full input (reuses detect_faces.py, detect_plates.py)</li>
 *   <li>Blur each segment independently using blur_segment.py (only the regions within that segment's time range)</li>
 *   <li>Write an m3u8 manifest pointing at the blurred segments</li>
 *   <li>Cache the entire output directory by content hash</li>
 * </ol>
 *
 * <p>The companion {@code blurVideo()} method from {@link BlurPort} returns the m3u8 manifest as bytes;
 * individual segments are served via {@link #segment(String, String)}.</p>
 */
public final class StreamingBlurAdapter implements BlurPort {

    private static final Logger log = LoggerFactory.getLogger(StreamingBlurAdapter.class);
    private static final long TIMEOUT_SECONDS = 120;
    private static final int SEGMENT_DURATION = 2; // seconds per HLS segment
    private static final Duration CACHE_TTL = Duration.ofMinutes(20);

    private final Path scriptsDir;
    private final Map<String, CachedStream> cache = new ConcurrentHashMap<>();
    /** Tracks hashes being processed to avoid duplicate work. */
    private final java.util.Set<String> processing = ConcurrentHashMap.newKeySet();
    /** Base path for segment URLs in the rewritten manifest. Set by MediaController when wiring. */
    private String segmentBasePath = "/api/media/hls/";
    private final Clock clock;

    public StreamingBlurAdapter(Path scriptsDir) {
        this(scriptsDir, Clock.systemUTC());
    }

    StreamingBlurAdapter(Path scriptsDir, Clock clock) {
        this.scriptsDir = scriptsDir;
        this.clock = clock;
    }

    /** Set the base URL path for segment references in the m3u8 manifest. */
    public void setSegmentBasePath(String basePath) {
        this.segmentBasePath = basePath;
    }

    /**
     * Returns the m3u8 manifest as bytes. The manifest references segments by absolute path;
     * individual segments are served via {@link #segment(String, String)}.
     * Runs async: first call returns "processing", subsequent calls return the manifest once ready.
     */
    @Override
    public Result blurVideo(byte[] videoBytes, String offendingPlate) {
        String hash = sha256(videoBytes) + "-" + (offendingPlate != null ? offendingPlate : "NONE");
        evictExpired();
        CachedStream cached = cache.get(hash);
        if (cached != null && cached.expiresAt.isAfter(clock.instant())) {
            log.info("Streaming blur cache hit for {}", hash.substring(0, 12));
            return Result.ok(cached.manifest, "application/vnd.apple.mpegurl");
        }
        if (cached != null) {
            cache.remove(hash);
        }

        // Async: start blur in background, return "processing" immediately
        if (processing.add(hash)) {
            log.info("Starting async streaming blur for {} ({} bytes)", hash.substring(0, 12), videoBytes.length);
            Thread.startVirtualThread(() -> {
                try {
                    Result result = blurSync(videoBytes, offendingPlate, hash);
                    if (result.success()) {
                        log.info("Async streaming blur done for {}", hash.substring(0, 12));
                    } else {
                        log.warn("Async streaming blur failed for {}: {}", hash.substring(0, 12), result.detail());
                    }
                } finally {
                    processing.remove(hash);
                }
            });
        } else {
            log.info("Streaming blur already in progress for {}", hash.substring(0, 12));
        }
        return Result.failed("Blur processing — try again shortly");
    }

    private Result blurSync(byte[] videoBytes, String offendingPlate, String hash) {
        try {
            Path workDir = Files.createTempDirectory("blur-stream-");
            Path input = workDir.resolve("input.mp4");
            Path segDir = workDir.resolve("segments");
            Files.createDirectories(segDir);
            Files.write(input, videoBytes);

            // Step 1: Split into HLS segments
            Path rawManifest = segDir.resolve("stream.m3u8");
            if (!runCmd(workDir, "ffmpeg", "-y", "-i", input.toString(),
                    "-c:v", "copy", "-an",
                    "-f", "hls", "-hls_time", String.valueOf(SEGMENT_DURATION),
                    "-hls_segment_type", "mpegts",
                    "-hls_segment_filename", segDir.resolve("seg-%03d.ts").toString(),
                    "-hls_list_size", "0",
                    rawManifest.toString())) {
                cleanup(workDir);
                return Result.failed("HLS segmentation failed");
            }

            // Step 2: Detect faces on the full input
            Path faceRegions = workDir.resolve("face-regions.json");
            if (!runScript(workDir, "detect_faces.py", input.toString(), "--output", faceRegions.toString())) {
                cleanup(workDir);
                return Result.failed("Face detection failed");
            }

            // Step 3: Detect plates on the full input
            Path plateRegions = workDir.resolve("plate-regions.json");
            String[] plateArgs = offendingPlate != null
                    ? new String[]{"detect_plates.py", input.toString(), "--offending", offendingPlate, "--output", plateRegions.toString()}
                    : new String[]{"detect_plates.py", input.toString(), "--output", plateRegions.toString()};
            if (!runScript(workDir, plateArgs)) {
                cleanup(workDir);
                return Result.failed("Plate detection failed");
            }

            // Step 4: Merge tracks
            Path mergedRegions = workDir.resolve("merged-regions.json");
            if (!runScript(workDir, "merge_tracks.py", faceRegions.toString(), plateRegions.toString(),
                    "--output", mergedRegions.toString())) {
                cleanup(workDir);
                return Result.failed("Track merge failed");
            }

            // Step 5: Blur each segment (fail-closed: any failure = whole video fails)
            List<Path> rawSegments;
            try (Stream<Path> files = Files.list(segDir)) {
                rawSegments = files.filter(p -> p.toString().endsWith(".ts")).sorted().toList();
            }

            Path blurredDir = workDir.resolve("blurred");
            Files.createDirectories(blurredDir);

            for (int i = 0; i < rawSegments.size(); i++) {
                Path seg = rawSegments.get(i);
                Path blurredSeg = blurredDir.resolve(seg.getFileName());
                double tStart = i * SEGMENT_DURATION;
                double tEnd = (i + 1) * SEGMENT_DURATION;
                if (!runScript(workDir, "blur_segment.py",
                        seg.toString(), mergedRegions.toString(),
                        "--output", blurredSeg.toString(),
                        "--t-start", String.valueOf(tStart),
                        "--t-end", String.valueOf(tEnd))) {
                    cleanup(workDir);
                    return Result.failed("Segment blur failed for " + seg.getFileName());
                }
            }

            // Step 6: Cache all blurred segments
            Map<String, byte[]> segments = new ConcurrentHashMap<>();
            try (Stream<Path> files = Files.list(blurredDir)) {
                files.filter(p -> p.toString().endsWith(".ts")).forEach(p -> {
                    try {
                        segments.put(p.getFileName().toString(), Files.readAllBytes(p));
                    } catch (IOException e) {
                        log.error("Failed to read blurred segment {}", p, e);
                    }
                });
            }

            // Step 7: Rewrite manifest with absolute segment URLs
            String manifestContent = rewriteManifest(rawManifest, hash);
            byte[] manifestBytes = manifestContent.getBytes();

            cache.put(hash, new CachedStream(manifestBytes, segments, clock.instant().plus(CACHE_TTL)));
            log.info("Streaming blur done: {} segments, manifest {} bytes, cached as {}",
                    segments.size(), manifestBytes.length, hash.substring(0, 12));

            cleanup(workDir);
            return Result.ok(manifestBytes, "application/vnd.apple.mpegurl");

        } catch (IOException e) {
            log.error("Streaming blur failed", e);
            return Result.failed("IO error: " + e.getMessage());
        }
    }

    /**
     * Serve one blurred segment from cache. Accepts a hash prefix (first 16 chars)
     * to keep URLs shorter; finds the matching full hash.
     * @param hashPrefix first 16 chars of the cache key
     * @param segmentName e.g. "seg-000.ts"
     * @return the blurred segment bytes, or empty if not found
     */
    public Optional<byte[]> segment(String hashPrefix, String segmentName) {
        for (var entry : cache.entrySet()) {
            if (entry.getKey().startsWith(hashPrefix) && entry.getValue().expiresAt.isAfter(clock.instant())) {
                return Optional.ofNullable(entry.getValue().segments.get(segmentName));
            }
        }
        return Optional.empty();
    }

    @Override
    public Result blurImage(byte[] imageBytes, String offendingPlate) {
        return Result.ok(imageBytes, "image/jpeg");
    }

    // --- internals ---

    /**
     * Rewrite the m3u8 manifest so segment paths are absolute URLs via the segment endpoint.
     * E.g. "seg-000.ts" becomes "/api/media/hls/{hash}/seg-000.ts"
     */
    private String rewriteManifest(Path original, String hash) throws IOException {
        StringBuilder sb = new StringBuilder();
        for (String line : Files.readAllLines(original)) {
            if (line.endsWith(".ts")) {
                // Extract just the filename (may have a path prefix)
                String name = line.contains("/") ? line.substring(line.lastIndexOf('/') + 1) : line;
                sb.append(segmentBasePath).append(hash.substring(0, 16)).append("/").append(name);
            } else {
                sb.append(line);
            }
            sb.append("\n");
        }
        return sb.toString();
    }

    private boolean runScript(Path workDir, String... args) {
        String[] cmd = new String[args.length + 2];
        cmd[0] = "python3";
        cmd[1] = "-I";
        for (int i = 0; i < args.length; i++) {
            if (i == 0 && !args[i].contains("/")) {
                cmd[i + 2] = scriptsDir.resolve(args[i]).toString();
            } else {
                cmd[i + 2] = args[i];
            }
        }
        return exec(workDir, cmd, args[0]);
    }

    private boolean runCmd(Path workDir, String... cmd) {
        return exec(workDir, cmd, cmd.length > 0 ? cmd[0] : "cmd");
    }

    private boolean exec(Path workDir, String[] cmd, String label) {
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(workDir.toFile());
            pb.redirectErrorStream(true);
            pb.environment().put("PYTHONDONTWRITEBYTECODE", "1");
            pb.environment().put("PYTHONUNBUFFERED", "1");
            Process p = pb.start();

            // Stream output line-by-line (same pattern as ProcessBlurAdapter)
            Thread outputDrainer = Thread.startVirtualThread(() -> {
                try (var reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        log.info("[streaming-blur:{}] {}", label, line);
                    }
                } catch (IOException ignored) {}
            });

            boolean finished = p.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!finished) {
                log.warn("Streaming blur script {} timed out after {}s", label, TIMEOUT_SECONDS);
                p.destroyForcibly();
                outputDrainer.interrupt();
                return false;
            }
            outputDrainer.join(5_000);
            boolean ok = p.exitValue() == 0;
            if (!ok) {
                log.warn("Streaming blur script {} exited with code {}", label, p.exitValue());
            }
            return ok;
        } catch (IOException | InterruptedException e) {
            log.error("Failed to exec streaming blur script {}", label, e);
            return false;
        }
    }

    private void evictExpired() {
        Instant now = clock.instant();
        cache.entrySet().removeIf(e -> e.getValue().expiresAt.isBefore(now));
    }

    private static void cleanup(Path dir) {
        try {
            Files.walk(dir).sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                try { Files.deleteIfExists(p); } catch (IOException ignored) {}
            });
        } catch (IOException ignored) {}
    }

    static String sha256(byte[] data) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    /** Compute the cache key for a video — used by MediaController to resolve segment requests. */
    public static String cacheKey(byte[] videoBytes, String offendingPlate) {
        return sha256(videoBytes) + "-" + (offendingPlate != null ? offendingPlate : "NONE");
    }

    private record CachedStream(byte[] manifest, Map<String, byte[]> segments, Instant expiresAt) {}
}
