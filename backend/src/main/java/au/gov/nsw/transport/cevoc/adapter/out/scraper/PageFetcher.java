package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.io.IOException;
import java.net.URI;

/** Fetches one URL. The only seam to the network, so tests can fake it. */
public interface PageFetcher {

    record Response(int status, String contentType, byte[] body) {}

    Response get(URI uri) throws IOException, InterruptedException;
}
