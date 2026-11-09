package cevoc.adapter.out.blur;

import cevoc.application.port.out.BlurPort;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Blur adapter that calls the Python blur pipeline as a subprocess (ADR 0017).
 * Steps: detect faces (YuNet) → detect plates (contour + OCR) → merge → render.
 * Caches by content hash so the same video is processed only once.
 * Fail-closed: any subprocess failure means the video is not released.
 */
public final class ProcessBlurAdapter implements BlurPort {

    private static final Logger log = LoggerFactory.getLogger(ProcessBlurAdapter.class);
    private static final long TIMEOUT_SECONDS = 120;

    private final Path scriptsDir;
    private final Map<String, CachedResult> cache = new ConcurrentHashMap<>();

    public ProcessBlurAdapter(Path scriptsDir) {
        this.scriptsDir = scriptsDir;
    }

    @Override
    public Result blurVideo(byte[] videoBytes, String offendingPlate) {
        String hash = sha256(videoBytes) + "-" + (offendingPlate != null ? offendingPlate : "NONE");
        CachedResult cached = cache.get(hash);
        if (cached != null) {
            log.info("Blur cache hit for video hash {}", hash.substring(0, 12));
            return cached.result;
        }

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
            Result result = Result.ok(blurred, "video/mp4");
            cache.put(hash, new CachedResult(result));
            log.info("Blurred video: {} -> {} bytes, cached as {}", videoBytes.length, blurred.length, hash.substring(0, 12));

            cleanup(tmpDir);
            return result;

        } catch (IOException e) {
            log.error("Blur processing failed", e);
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
            String out = new String(p.getInputStream().readAllBytes());
            boolean ok = p.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS) && p.exitValue() == 0;
            if (!ok) {
                log.warn("Blur script {} failed (exit {}): {}", args[0], p.isAlive() ? "timeout" : p.exitValue(),
                        out.length() > 500 ? out.substring(0, 500) : out);
                if (p.isAlive()) p.destroyForcibly();
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

    private record CachedResult(Result result) {}
}
