package au.gov.nsw.transport.cevoc.adapter.in.web;

import au.gov.nsw.transport.cevoc.application.port.out.MediaReadPort;
import au.gov.nsw.transport.cevoc.domain.ImageVariant;
import au.gov.nsw.transport.cevoc.domain.MediaContent;
import java.time.Duration;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serves the bytes behind a link made by the in-memory media adapter. Present only so that storage without links of its
 * own has somewhere to point; cloud storage hands out its own links and no {@link MediaReadPort} exists then (404).
 * The token is the only input, an unguessable random value; bytes and tokens are never logged.
 */
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private final ObjectProvider<MediaReadPort> media;

    public MediaController(ObjectProvider<MediaReadPort> media) {
        this.media = media;
    }

    @GetMapping("/{token:[A-Za-z0-9_-]{16,64}}")
    public ResponseEntity<byte[]> get(@PathVariable String token, @RequestParam(name = "s", required = false) String size,
                                      @RequestParam(name = "dl", required = false) String download) {
        MediaReadPort port = media.getIfAvailable();
        if (port == null) {
            return ResponseEntity.notFound().build();
        }
        ImageVariant variant = "thumb".equals(size) ? ImageVariant.THUMBNAIL : "medium".equals(size) ? ImageVariant.MEDIUM : null;
        return port.read(token, variant).map(c -> ok(c, download != null)).orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static ResponseEntity<byte[]> ok(MediaContent c, boolean download) {
        MediaType type;
        try {
            type = MediaType.parseMediaType(c.contentType());
        } catch (RuntimeException e) {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }
        return ResponseEntity.ok()
                .contentType(type)
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePrivate())
                .header("X-Content-Type-Options", "nosniff")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .header(HttpHeaders.CONTENT_DISPOSITION, download ? "attachment; filename=\"camera-evidence\"" : "inline")
                .body(c.data());
    }
}
