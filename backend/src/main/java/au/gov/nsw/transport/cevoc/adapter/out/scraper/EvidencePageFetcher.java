package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.io.IOException;
import java.net.URI;
import java.util.Map;

/** Fetches one URL. The only seam to the network, so tests can fake it. */
public interface EvidencePageFetcher {

    record Response(int status, String contentType, byte[] body) {}

    Response get(URI uri) throws IOException, InterruptedException;

    /**
     * Submits a form (application/x-www-form-urlencoded). Callers may put the vehicle registration in
     * {@code form}: implementations must not log, store or echo the form values, in errors or anywhere else.
     */
    Response post(URI uri, Map<String, String> form) throws IOException, InterruptedException;
}
