package au.gov.nsw.transport.cevoc.adapter.out.azureblob;

import au.gov.nsw.transport.cevoc.application.port.out.CacheInvalidationPort;

/**
 * Azure has no CDN in front of the container yet, so there is nothing to purge. When Front Door or
 * Azure CDN is added, implement the purge here (still inside adapter.out.azureblob).
 */
public class AzureCacheInvalidationAdapter implements CacheInvalidationPort {
    @Override
    public void invalidate(String objectKey) {
        // Intentionally empty: SAS links expire on their own.
    }
}
