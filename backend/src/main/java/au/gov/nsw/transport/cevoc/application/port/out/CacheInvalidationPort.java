package au.gov.nsw.transport.cevoc.application.port.out;

/** Driven port: drop an object from any CDN or cache in front of storage (for example after replacement or withdrawal). */
public interface CacheInvalidationPort {
    void invalidate(String objectKey);
}
