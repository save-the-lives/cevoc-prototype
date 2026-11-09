package cevoc.adapter.out.demo;

import cevoc.adapter.in.web.DemoRoutes;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Reads raw demo video files from the filesystem (frontend/public/samples/) or classpath.
 * The raw video is then passed through the {@link cevoc.application.port.out.BlurPort} before serving.
 */
public final class ClasspathVideoSource implements DemoRoutes.DemoVideoSource {

    private static final Logger log = LoggerFactory.getLogger(ClasspathVideoSource.class);
    private final Path samplesDir;

    public ClasspathVideoSource(Path samplesDir) {
        this.samplesDir = samplesDir;
    }

    @Override
    public Optional<byte[]> read(String name) {
        if (name == null || name.contains("..") || name.contains("/")) {
            return Optional.empty();
        }
        // Try filesystem first (works in development)
        Path file = samplesDir.resolve(name);
        if (Files.isRegularFile(file)) {
            try {
                log.debug("Reading raw video from filesystem: {}", file);
                return Optional.of(Files.readAllBytes(file));
            } catch (IOException e) {
                log.warn("Failed to read video {}", file, e);
            }
        }
        // Fallback: classpath (works in container)
        try (InputStream is = getClass().getClassLoader().getResourceAsStream("samples/" + name)) {
            if (is != null) {
                log.debug("Reading raw video from classpath: samples/{}", name);
                return Optional.of(is.readAllBytes());
            }
        } catch (IOException e) {
            log.warn("Failed to read video from classpath: samples/{}", name, e);
        }
        return Optional.empty();
    }
}
