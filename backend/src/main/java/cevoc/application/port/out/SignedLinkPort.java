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

    /**
     * A link to the original that also carries the plate to keep visible when the media is blurred (record 0033). The
     * plate is the person's own, from the lookup that made the link; it is held with the link in memory for the link's
     * lifetime only, never stored, logged or put in the link. Storage that cannot hold it ignores it, and then every
     * plate is blurred, which is the privacy-safe outcome.
     */
    default SignedLink linkFor(String objectKey, Duration validFor, String keepVisiblePlate) {
        return linkFor(objectKey, validFor);
    }

    /** A link to a smaller copy of an image, or empty when this storage keeps only the original. */
    default Optional<SignedLink> linkFor(String objectKey, ImageVariant variant, Duration validFor) {
        return Optional.empty();
    }
}
