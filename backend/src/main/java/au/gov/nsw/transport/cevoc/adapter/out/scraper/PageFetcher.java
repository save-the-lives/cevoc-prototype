package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.util.Map;

/** Minimal HTTP seam so tests never touch the network. */
public interface PageFetcher {
    /** GET the page; returns HTML. */
    String get(String url);

    /** POST form fields (url-encoded) and return HTML. */
    String postForm(String url, Map<String, String> fields);
}
