package cevoc.adapter.out.scraper;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The request headers a desktop Chrome navigation sends, for the plain-HTTP certificates leg (owner-approved 2026-11-07,
 * docs/decisions/0024-certificates-http-browser-headers.md). Header NAMES and fixed browser values only; nothing here
 * carries user data. {@code Accept-Encoding} is deliberately absent: the JDK client does not decompress, so asking for
 * gzip would hand back bytes the parser cannot read.
 */
final class BrowserHeaders {

    static final String USER_AGENT =
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

    private BrowserHeaders() {}

    /** First navigation to the page (address typed or bookmarked): no referrer, {@code Sec-Fetch-Site: none}. */
    static Map<String, String> forGet() {
        Map<String, String> h = common();
        h.put("Sec-Fetch-Site", "none");
        return h;
    }

    /** The form submit from the page itself: same-origin POST with the page as referrer. */
    static Map<String, String> forFormPost(String pageUrl, String actionUrl) {
        Map<String, String> h = common();
        URI action = URI.create(actionUrl);
        h.put("Origin", action.getScheme() + "://" + action.getAuthority());
        h.put("Referer", pageUrl);
        h.put("Cache-Control", "max-age=0");
        h.put("Sec-Fetch-Site", "same-origin");
        return h;
    }

    private static Map<String, String> common() {
        Map<String, String> h = new LinkedHashMap<>();
        h.put("User-Agent", USER_AGENT);
        h.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8");
        h.put("Accept-Language", "en-AU,en;q=0.9");
        h.put("Upgrade-Insecure-Requests", "1");
        h.put("Sec-Fetch-Mode", "navigate");
        h.put("Sec-Fetch-Dest", "document");
        h.put("Sec-Fetch-User", "?1");
        h.put("sec-ch-ua", "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"");
        h.put("sec-ch-ua-mobile", "?0");
        h.put("sec-ch-ua-platform", "\"Linux\"");
        return h;
    }
}
