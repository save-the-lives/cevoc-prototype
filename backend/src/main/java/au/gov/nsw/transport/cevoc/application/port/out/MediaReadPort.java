package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.ImageVariant;
import au.gov.nsw.transport.cevoc.domain.MediaContent;
import java.util.Optional;

/**
 * Driven port, only for storage that cannot hand out its own links (the in-memory adapter): the bytes behind a link
 * made by {@link SignedLinkPort}. Cloud storage adapters do not implement it; the browser reads those directly.
 */
public interface MediaReadPort {
    /** The bytes for a link token (null variant = original), or empty when unknown or expired. */
    Optional<MediaContent> read(String token, ImageVariant variant);
}
