package cevoc.application.port.out;

import cevoc.domain.ImageVariant;
import cevoc.domain.SignedLink;
import java.time.Duration;
import java.util.Optional;

/**
 * Driven port: a short-lived, unguessable, read-only link to an object. The browser fetches the media
 * directly from storage/CDN with this link; the backend never proxies media bytes.
 */
public interface SignedLinkPort {
    SignedLink linkFor(String objectKey, Duration validFor);

    /** A link to a smaller copy of an image, or empty when this storage keeps only the original. */
    default Optional<SignedLink> linkFor(String objectKey, ImageVariant variant, Duration validFor) {
        return Optional.empty();
    }
}
