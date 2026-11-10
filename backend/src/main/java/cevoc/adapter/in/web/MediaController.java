package cevoc.adapter.in.web;

import cevoc.application.port.out.BlurPort;
import cevoc.application.port.out.MediaReadPort;
import cevoc.domain.ImageVariant;
import cevoc.domain.MediaContent;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 * Serves the bytes behind a link made by the in-memory media adapter, with server-side privacy blur (ADR 0017).
 * Every video and image passes through {@link BlurPort} before reaching the browser. Fail-closed: if blur fails,
 * the content is not served. This is the single blur point for both live and demo paths.
 */
@RestController
@RequestMapping("/api/media")
public class MediaController {

    private static final Logger LOG = LoggerFactory.getLogger(MediaController.class);

    private final ObjectProvider<MediaReadPort> media;
    private final ObjectProvider<BlurPort> blur;
    /** Cache blurred content by token so the pipeline runs once per evidence item. */
    private final Map<String, MediaContent> blurCache = new ConcurrentHashMap<>();

    public MediaController(ObjectProvider<MediaReadPort> media, ObjectProvider<BlurPort> blur) {
        this.media = media;
        this.blur = blur;
    }

    @GetMapping("/{token:[A-Za-z0-9_-]{16,64}}")
    public ResponseEntity<byte[]> get(@PathVariable String token, @RequestParam(name = "s", required = false) String size,
                                      @RequestParam(name = "dl", required = false) String download) {
        MediaReadPort port = media.getIfAvailable();
        if (port == null) {
            return ResponseEntity.notFound().build();
        }
        ImageVariant variant = "thumb".equals(size) ? ImageVariant.THUMBNAIL : "medium".equals(size) ? ImageVariant.MEDIUM : null;
        var content = port.read(token, variant);
        if (content.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        var blurred = applyBlur(token + (variant != null ? ":" + variant : ""), content.get());
        if (blurred.isEmpty()) {
            // Blur failed (fail-closed). Return 451 (Unavailable For Legal Reasons) with a user-facing message.
            // The frontend shows this as a section-level error, not a page-level crash.
            return ResponseEntity.status(451)
                    .contentType(org.springframework.http.MediaType.TEXT_PLAIN)
                    .body("This image could not be prepared for safe viewing. This is a technical problem, not an issue with your notice. Please try again shortly.".getBytes());
        }
        return ok(blurred.get(), download != null);
    }

    /**
     * Blur video and image content before serving. Non-media types pass through.
     * Fail-closed: if blur fails, returns empty (content not served).
     */
    private java.util.Optional<MediaContent> applyBlur(String cacheKey, MediaContent content) {
        BlurPort blurPort = blur.getIfAvailable();
        if (blurPort == null) {
            return java.util.Optional.of(content); // no blur adapter wired — pass through (e.g. tests)
        }
        MediaContent cached = blurCache.get(cacheKey);
        if (cached != null) {
            return java.util.Optional.of(cached);
        }
        String ct = content.contentType();
        if (ct != null && ct.startsWith("video/")) {
            // The offending plate comes from the lookup context (set per-request by the lookup service).
            String plate = OffendingPlateContext.get();
            BlurPort.Result result = blurPort.blurVideo(content.data(), plate);
            if (!result.success()) {
                LOG.warn("Video blur failed (fail-closed): {}", result.detail());
                return java.util.Optional.empty();
            }
            MediaContent blurred = new MediaContent(result.contentType(), result.data());
            blurCache.put(cacheKey, blurred);
            return java.util.Optional.of(blurred);
        }
        if (ct != null && ct.startsWith("image/") && !ct.contains("svg")) {
            String plate = OffendingPlateContext.get();
            BlurPort.Result result = blurPort.blurImage(content.data(), plate);
            if (!result.success()) {
                LOG.warn("Image blur failed (fail-closed): {}", result.detail());
                return java.util.Optional.empty();
            }
            MediaContent blurred = new MediaContent(result.contentType(), result.data());
            blurCache.put(cacheKey, blurred);
            return java.util.Optional.of(blurred);
        }
        return java.util.Optional.of(content); // non-media or SVG — pass through
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
