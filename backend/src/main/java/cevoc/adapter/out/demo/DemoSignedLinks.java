package cevoc.adapter.out.demo;

import cevoc.application.port.out.MediaStoragePort;
import cevoc.application.port.out.SignedLinkPort;
import cevoc.domain.ImageVariant;
import cevoc.domain.SignedLink;
import java.io.ByteArrayInputStream;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Links for demo media, in front of the configured link maker. {@code demo/<number>/<file>} points at the demo media endpoint,
 * {@code samples/<path>} goes through the shared media path (stored in MediaStoragePort, served by MediaController with blur).
 * Any other key goes to the configured one unchanged.
 */
public final class DemoSignedLinks implements SignedLinkPort {

    private static final Logger LOG = LoggerFactory.getLogger(DemoSignedLinks.class);
    static final String MEDIA_PATH = "/api/demo/media/";
    private final SignedLinkPort delegate;
    private final MediaStoragePort storage;
    private final VideoSource videoSource;

    /** Reads raw demo video bytes by filename (e.g. "video-1.mp4"). */
    @FunctionalInterface
    public interface VideoSource {
        Optional<byte[]> read(String name);
    }

    private DemoSignedLinks(SignedLinkPort delegate, MediaStoragePort storage, VideoSource videoSource) {
        this.delegate = delegate;
        this.storage = storage;
        this.videoSource = videoSource;
    }

    /** No video support — demo images only, videos will 404. */
    public static SignedLinkPort wrapping(SignedLinkPort delegate) {
        return new DemoSignedLinks(delegate, null, null);
    }

    /** Full support: demo images served directly, demo videos stored in the shared media path and blurred by MediaController. */
    public static SignedLinkPort wrapping(SignedLinkPort delegate, MediaStoragePort storage, VideoSource videoSource) {
        return new DemoSignedLinks(delegate, storage, videoSource);
    }

    @Override
    public SignedLink linkFor(String objectKey, Duration validFor) {
        // Demo-generated images (SVG): served by DemoRoutes /api/demo/media/{number}/{name}
        if (objectKey != null && objectKey.startsWith("demo/")) {
            return new SignedLink(MEDIA_PATH + objectKey.substring("demo/".length()), Instant.now().plus(validFor));
        }
        // Sample videos: store bytes in the shared MediaStoragePort so they go through
        // MediaController → BlurPort (the same hot path as live evidence).
        if (objectKey != null && objectKey.startsWith("samples/") && objectKey.endsWith(".mp4")) {
            ensureStored(objectKey);
            return delegate.linkFor(objectKey, validFor);
        }
        // Static sample images (non-video): serve directly from frontend
        if (objectKey != null && objectKey.startsWith("samples/")) {
            return new SignedLink("/" + objectKey, Instant.now().plus(validFor));
        }
        return delegate.linkFor(objectKey, validFor);
    }

    @Override
    public Optional<SignedLink> linkFor(String objectKey, ImageVariant variant, Duration validFor) {
        if (objectKey != null && objectKey.startsWith("demo/")) {
            return Optional.empty(); // SVGs have no variants
        }
        if (objectKey != null && objectKey.startsWith("samples/") && objectKey.endsWith(".mp4")) {
            ensureStored(objectKey);
            return delegate.linkFor(objectKey, variant, validFor);
        }
        if (objectKey != null && objectKey.startsWith("samples/")) {
            return Optional.empty();
        }
        return delegate.linkFor(objectKey, variant, validFor);
    }

    /**
     * Store the video bytes in the shared media adapter if not already there.
     * This lets the video flow through MediaController → applyBlur() — the same
     * hot path as live evidence. The offending plate comes from OffendingPlateContext
     * (set per-request by PenaltyLookupStreamController from the person's registration).
     */
    private void ensureStored(String objectKey) {
        if (storage == null || videoSource == null) {
            return;
        }
        if (storage.exists(objectKey)) {
            return; // already stored (and not yet expired)
        }
        // Extract filename from key: "samples/video-1.mp4" → "video-1.mp4"
        String name = objectKey.substring("samples/".length());
        videoSource.read(name).ifPresentOrElse(
                bytes -> {
                    LOG.info("Storing demo video {} ({} bytes) in shared media for blur path", objectKey, bytes.length);
                    storage.store(objectKey, "video/mp4", new ByteArrayInputStream(bytes), bytes.length);
                },
                () -> LOG.warn("Demo video not found: {}", name)
        );
    }
}
