package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.io.IOException;
import java.net.URI;

/** Starts one {@link RenderedPageSession} for the site at {@code baseUrl}. The caller must close it. */
@FunctionalInterface
public interface RenderedPageSessionFactory {

    RenderedPageSession open(URI baseUrl) throws IOException;
}
