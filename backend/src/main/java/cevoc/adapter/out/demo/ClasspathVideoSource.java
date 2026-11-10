package cevoc.adapter.out.demo;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reads raw demo video files from the filesystem (frontend/public/samples/) or classpath.
 * Used by {@link DemoSignedLinks} to store demo video bytes in the shared media adapter,
 * so they flow through MediaController → BlurPort (the same hot path as live evidence).
 */
public final class ClasspathVideoSource {

    private static final Logger log = LoggerFactory.getLogger(ClasspathVideoSource.class);
    private final Path samplesDir;

    /** Candidate directories tried in order: explicit config, container default, dev default. */
    private static final String[] FALLBACK_DIRS = {"samples", "../frontend/public/samples"};

    public ClasspathVideoSource(Path samplesDir) {
        this.samplesDir = samplesDir;
    }

    public Optional<byte[]> read(String name) {
        if (name == null || name.contains("..") || name.contains("/")) {
            return Optional.empty();
        }
        // Try configured directory first
        if (samplesDir != null) {
            Optional<byte[]> found = readFile(samplesDir.resolve(name));
            if (found.isPresent()) return found;
        }
        // Try fallback directories (container: /app/samples, dev: ../frontend/public/samples)
        for (String dir : FALLBACK_DIRS) {
            Optional<byte[]> found = readFile(Path.of(dir).resolve(name));
            if (found.isPresent()) return found;
        }
        // Last resort: classpath
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("samples/" + name)) {
            if (is != null) {
                log.debug("Reading raw video from classpath: samples/{}", name);
                return Optional.of(is.readAllBytes());
            }
        } catch (IOException e) {
            log.warn("Failed to read video from classpath: samples/{}", name, e);
        }
        log.warn("Demo video not found: {} (tried {} + fallbacks + classpath)", name, samplesDir);
        return Optional.empty();
    }

    private Optional<byte[]> readFile(Path file) {
        if (Files.isRegularFile(file)) {
            try {
                log.debug("Reading raw video from filesystem: {}", file);
                return Optional.of(Files.readAllBytes(file));
            } catch (IOException e) {
                log.warn("Failed to read video {}", file, e);
            }
        }
        return Optional.empty();
    }
}
