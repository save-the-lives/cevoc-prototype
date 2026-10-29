package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.SignedLink;
import java.time.Duration;

/**
 * Driven port: a short-lived, unguessable, read-only link to an object. The browser fetches the media
 * directly from storage/CDN with this link; the backend never proxies media bytes.
 */
public interface SignedLinkPort {
    SignedLink linkFor(String objectKey, Duration validFor);
}
