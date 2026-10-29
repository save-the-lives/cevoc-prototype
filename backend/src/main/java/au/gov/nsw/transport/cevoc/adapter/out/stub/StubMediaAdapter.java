package au.gov.nsw.transport.cevoc.adapter.out.stub;

import au.gov.nsw.transport.cevoc.application.port.out.CacheInvalidationPort;
import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import au.gov.nsw.transport.cevoc.domain.SignedLink;
import java.io.InputStream;
import java.time.Duration;
import java.time.Instant;

/** No-cloud media adapter: links point at sample files under a base URL (default /samples). Stores nothing. */
public class StubMediaAdapter implements MediaStoragePort, SignedLinkPort, CacheInvalidationPort {

    private final String baseUrl;

    public StubMediaAdapter(String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    @Override
    public void store(String objectKey, String contentType, InputStream content, long contentLength) {
        // Stub: nothing is stored; the sample files are served statically.
    }

    @Override
    public boolean exists(String objectKey) {
        return true;
    }

    @Override
    public SignedLink linkFor(String objectKey, Duration validFor) {
        return new SignedLink(baseUrl + "/" + objectKey, Instant.now().plus(validFor));
    }

    @Override
    public void invalidate(String objectKey) {
        // Stub: no cache.
    }
}
