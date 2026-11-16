package cevoc.application.port.out;

import cevoc.domain.ImageVariant;
import cevoc.domain.MediaContent;
import java.util.Optional;

/**
 * Driven port, only for storage that cannot hand out its own links (the in-memory adapter): the bytes behind a link
 * made by {@link SignedLinkPort}. Cloud storage adapters do not implement it; the browser reads those directly.
 */
public interface MediaReadPort {
    /** The bytes for a link token (null variant = original), or empty when unknown or expired. */
    Optional<MediaContent> read(String token, ImageVariant variant);

    /** The plate to keep visible when blurring the media behind this link (record 0033), or empty: blur every plate. */
    default Optional<String> keepVisiblePlate(String token) {
        return Optional.empty();
    }
}
