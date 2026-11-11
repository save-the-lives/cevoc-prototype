package cevoc.application.port.out;

import java.util.Optional;

/**
 * Driven port: serve HLS segments from the streaming blur cache.
 * Only implemented when streaming blur is active; otherwise absent (ObjectProvider returns null).
 */
public interface HlsSegmentPort {

    /** Retrieve a cached HLS segment by hash prefix and segment name. */
    Optional<byte[]> segment(String hashPrefix, String segmentName);
}
