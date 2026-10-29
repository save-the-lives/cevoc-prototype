package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Saves the raw rendered HTML of each step to a LOCAL folder for the owner (gitignored live-capture/). The files
 * can hold real notice data, so they are owner-only and must be redacted before anyone else sees them.
 * Failures to write are swallowed: capture must never break a lookup.
 */
final class HtmlCapture {

    private final Path dir;
    private final String runId = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
    private int n;

    HtmlCapture(Path dir) {
        this.dir = dir;
    }

    void save(String step, String html) {
        try {
            Files.createDirectories(dir);
            Path f = dir.resolve(runId + "-" + (++n) + "-" + step + ".html");
            Files.writeString(f, html == null ? "" : html, StandardCharsets.UTF_8);
            try {
                Files.setPosixFilePermissions(f, PosixFilePermissions.fromString("rw-------"));
            } catch (UnsupportedOperationException ignored) {
                // non-POSIX file system
            }
        } catch (IOException | RuntimeException ignored) {
            // never fail the lookup because a capture could not be written
        }
    }
}
