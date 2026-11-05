package cevoc.application.port.out;

import java.io.IOException;

/**
 * Driven port: fetches the demo content bundle (one archive) from a location given only as a URL in configuration. The
 * port knows nothing about where the bytes live or how they are fetched; the one adapter does a plain HTTPS download with no
 * credentials. Throws when the location is unreachable, answers an error, or is larger than {@code maxBytes}.
 */
public interface DemoBundleSourcePort {

    byte[] fetch(String location, long maxBytes) throws IOException;
}
