package au.gov.nsw.transport.cevoc.application.port.out;

import java.io.InputStream;

/** Driven port: store and locate evidence objects (image, video, certificate) in object storage. Cloud-neutral. */
public interface MediaStoragePort {
    /** Stores (or replaces) the object under the given key. */
    void store(String objectKey, String contentType, InputStream content, long contentLength);

    boolean exists(String objectKey);
}
