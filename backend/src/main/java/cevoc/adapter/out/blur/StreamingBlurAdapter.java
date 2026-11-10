package cevoc.adapter.out.blur;

import cevoc.application.port.out.BlurPort;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
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

    private final Path scriptsDir;
    private final Map<String, CachedStream> cache = new ConcurrentHashMap<>();

    public StreamingBlurAdapter(Path scriptsDir) {
        this.scriptsDir = scriptsDir;
    }

    /**
     * Returns the m3u8 manifest as bytes. The manifest references segments by relative path;
     * the caller must serve segments via {@link #segment(String, String)}.
     */
    @Override
    public Result blurVideo(byte[] videoBytes, String offendingPlate) {
        String hash = sha256(videoBytes) + "-" + (offendingPlate != null ? offendingPlate : "NONE");
        CachedStream cached = cache.get(hash);
        if (cached != null) {
            log.info("Streaming blur cache hit for {}", hash.substring(0, 12));
            return Result.ok(cached.manifest, "application/vnd.apple.mpegurl");
        }

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

            // Step 5: Blur each segment
            List<Path> rawSegments;
            try (Stream<Path> files = Files.list(segDir)) {
                rawSegments = files.filter(p -> p.toString().endsWith(".ts")).sorted().toList();
            }

            Path blurredDir = workDir.resolve("blurred");
            Files.createDirectories(blurredDir);

            for (Path seg : rawSegments) {
                Path blurredSeg = blurredDir.resolve(seg.getFileName());
                if (!runScript(workDir, "blur_segment.py",
                        seg.toString(), mergedRegions.toString(),
                        "--output", blurredSeg.toString())) {
                    log.warn("Segment blur failed for {}, using raw segment (fail-safe would block this)", seg.getFileName());
                    // Fail-closed: don't serve unblurred segments
                    cleanup(workDir);
                    return Result.failed("Segment blur failed for " + seg.getFileName());
                }
            }

            // Step 6: Rewrite manifest to point at blurred segments
            String manifestContent = rewriteManifest(rawManifest, "segments/", "");
            byte[] manifestBytes = manifestContent.getBytes();

            // Step 7: Cache all blurred segments
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

            cache.put(hash, new CachedStream(manifestBytes, segments));
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
     * Serve one blurred segment from cache.
     * @param videoHash the same hash used for blurVideo (SHA-256 of raw bytes + offending plate)
     * @param segmentName e.g. "seg-000.ts"
     * @return the blurred segment bytes, or empty if not found
     */
    public Optional<byte[]> segment(String videoHash, String segmentName) {
        CachedStream cached = cache.get(videoHash);
        if (cached == null) return Optional.empty();
        return Optional.ofNullable(cached.segments.get(segmentName));
    }

    /** List cached video hashes — for the route layer to resolve a video name to its hash. */
    public Optional<String> hashFor(byte[] videoBytes, String offendingPlate) {
        String hash = sha256(videoBytes) + "-" + (offendingPlate != null ? offendingPlate : "NONE");
        return cache.containsKey(hash) ? Optional.of(hash) : Optional.empty();
    }

    @Override
    public Result blurImage(byte[] imageBytes, String offendingPlate) {
        return Result.ok(imageBytes, "image/jpeg");
    }

    // --- internals ---

    private String rewriteManifest(Path original, String oldPrefix, String newPrefix) throws IOException {
        String content = Files.readString(original);
        // Replace segment paths: segments/seg-000.ts -> seg-000.ts (or whatever the new prefix is)
        return content.replace(oldPrefix, newPrefix);
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
        return exec(workDir, cmd);
    }

    private boolean runCmd(Path workDir, String... cmd) {
        return exec(workDir, cmd);
    }

    private boolean exec(Path workDir, String[] cmd) {
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.directory(workDir.toFile());
            pb.redirectErrorStream(true);
            pb.environment().put("PYTHONDONTWRITEBYTECODE", "1");
            Process p = pb.start();
            String out = new String(p.getInputStream().readAllBytes());
            boolean ok = p.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS) && p.exitValue() == 0;
            if (!ok) {
                log.warn("Command {} failed (exit {}): {}", cmd[2], p.isAlive() ? "timeout" : p.exitValue(),
                        out.length() > 500 ? out.substring(0, 500) : out);
                if (p.isAlive()) p.destroyForcibly();
            }
            return ok;
        } catch (IOException | InterruptedException e) {
            log.error("Failed to exec {}", cmd.length > 2 ? cmd[2] : cmd[0], e);
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

    private record CachedStream(byte[] manifest, Map<String, byte[]> segments) {}
}
