package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Request;
import com.microsoft.playwright.Response;
import java.net.URI;
import java.util.ArrayList;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;
import java.util.TreeSet;

/**
 * Records, in order, every request and response made by the pages of one browser context, as STRUCTURE only (see
 * {@link NetworkMapRedaction}). Only created when the live-check request asked for it. Nothing is logged; the lines
 * are handed to the live-check summary through {@link NetworkMapHolder}. Static assets (scripts, styles, fonts) are
 * only counted per host and step. A failure while recording never breaks the lookup.
 */
final class NetworkMapRecorder {

    private static final int MAX_ENTRIES = 120;
    private static final long MAX_BODY_BYTES = 3_000_000;

    private static final class Entry {
        int n;
        String step;
        String method;
        String host;
        String path;
        String query;
        String resourceType;
        String reqBody = "-";
        boolean reqJwt;
        int status = -1;
        String reqHeaders = "-";
        String authScheme = "none";
        String respHeaders = "-";
        String contentType = "-";
        String respShape = "-";
        boolean respJwt;
        boolean redirect;
        String failure;
    }

    private final Map<Request, Entry> open = new IdentityHashMap<>();
    private final List<Entry> entries = new ArrayList<>();
    private final Map<String, Integer> statics = new TreeMap<>();
    private volatile String step = "start";
    private int seq;
    private int dropped;

    void attach(BrowserContext context) {
        context.onRequest(req -> guard(() -> onRequest(req)));
        context.onResponse(resp -> guard(() -> onResponse(resp)));
        context.onRequestFailed(req -> guard(() -> onFailed(req)));
        context.onPage(p -> guard(() -> {
            addNav("page-opened", null);
            p.onFrameNavigated(f -> guard(() -> {
                if (f.parentFrame() == null) {
                    addNav("navigated", f.url());
                }
            }));
        }));
    }

    void step(String label) {
        this.step = label;
    }

    private static void guard(Runnable r) {
        try {
            r.run();
        } catch (RuntimeException ignored) {
            // recording must never break the flow
        }
    }

    private synchronized void onRequest(Request req) {
        String type = req.resourceType();
        URI u = URI.create(req.url());
        if (!"http".equals(u.getScheme()) && !"https".equals(u.getScheme())) {
            return; // data:, blob:, chrome-extension: are not network calls
        }
        if (type.equals("script") || type.equals("stylesheet") || type.equals("font") || type.equals("manifest")) {
            statics.merge(step + " " + type + " " + NetworkMapRedaction.host(u.getHost()), 1, Integer::sum);
            return;
        }
        if (entries.size() >= MAX_ENTRIES) {
            dropped++;
            return;
        }
        Entry e = new Entry();
        e.n = ++seq;
        e.step = step;
        e.method = req.method().toUpperCase(Locale.ROOT).replaceAll("[^A-Z]", "?");
        e.host = NetworkMapRedaction.host(u.getHost());
        e.path = NetworkMapRedaction.path(u.getRawPath());
        e.query = NetworkMapRedaction.queryKeys(u.getRawQuery());
        e.resourceType = type.replaceAll("[^a-z]", "?");
        String data = req.postData();
        if (data != null && !data.isEmpty()) {
            String ct = NetworkMapRedaction.contentType(req.headers().get("content-type"));
            if (ct.contains("json") || data.trim().startsWith("{") || data.trim().startsWith("[")) {
                e.reqBody = NetworkMapRedaction.jsonShape(data);
                e.reqJwt = NetworkMapRedaction.hasJwtValue(data);
            } else if (ct.contains("x-www-form-urlencoded")) {
                e.reqBody = NetworkMapRedaction.formShape(data);
            } else {
                e.reqBody = "other " + ct + " " + NetworkMapRedaction.sizeBucket(data.length());
            }
        } else if (req.postDataBuffer() != null && req.postDataBuffer().length > 0) {
            e.reqBody = "binary " + NetworkMapRedaction.sizeBucket(req.postDataBuffer().length);
        }
        entries.add(e);
        open.put(req, e);
    }

    private void onResponse(Response resp) {
        Entry e;
        synchronized (this) {
            e = open.get(resp.request());
        }
        if (e == null) {
            onRequest(resp.request()); // a hop whose request event was not seen (redirect, popup): record it now
            synchronized (this) {
                e = open.get(resp.request());
            }
            if (e == null) {
                return;
            }
            e.step = e.step + "(late)";
        }
        e.status = resp.status();
        e.redirect = e.status >= 300 && e.status < 400;
        e.reqHeaders = names(safeHeaders(resp.request()));
        e.authScheme = NetworkMapRedaction.authScheme(safeHeaders(resp.request()).get("authorization"));
        Map<String, String> rh = resp.headers();
        e.respHeaders = names(rh);
        e.contentType = NetworkMapRedaction.contentType(rh.get("content-type"));
        String type = resp.request().resourceType();
        boolean wantBody = e.contentType.contains("json") || e.contentType.startsWith("image/")
                || e.contentType.equals("application/pdf") || e.contentType.equals("application/octet-stream")
                || type.equals("xhr") || type.equals("fetch") || type.equals("image");
        if (!wantBody || e.redirect || e.status == 204) {
            return;
        }
        byte[] body;
        try {
            body = resp.body();
        } catch (RuntimeException ex) {
            e.respShape = "body-unavailable";
            return;
        }
        if (body == null || body.length > MAX_BODY_BYTES && !e.contentType.startsWith("image/")) {
            e.respShape = body == null ? "body-unavailable" : "large " + NetworkMapRedaction.sizeBucket(body.length);
            return;
        }
        String size = NetworkMapRedaction.sizeBucket(body.length);
        if (e.contentType.startsWith("image/")) {
            e.respShape = "image " + size + " ~" + NetworkMapRedaction.approxKb(body.length) + " px=" + NetworkMapRedaction.pixelSize(body)
                    + ("unknown".equals(NetworkMapRedaction.pixelSize(body)) ? " " + NetworkMapRedaction.imageHint(body) : "");
        } else if (e.contentType.contains("json")) {
            String text = new String(body, java.nio.charset.StandardCharsets.UTF_8);
            e.respShape = NetworkMapRedaction.jsonShape(text) + " (" + size + ")";
            e.respJwt = NetworkMapRedaction.hasJwtValue(text);
        } else if (e.contentType.equals("application/pdf") || e.contentType.equals("application/octet-stream")) {
            e.respShape = "binary " + size + (startsWith(body, "%PDF") ? " pdf" : "");
        } else {
            e.respShape = "other " + size;
        }
    }

    private final List<String> navs = new ArrayList<>();

    private synchronized void addNav(String what, String url) {
        if (navs.size() < 30) {
            navs.add("NETMAP nav step=" + step + " " + what + (url == null ? "" : " " + NetworkMapRedaction.url(url)));
        }
    }

    private synchronized void onFailed(Request req) {
        Entry e = open.get(req);
        if (e != null && e.status < 0) {
            e.status = 0;
            String f = String.valueOf(req.failure());
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("net::(ERR_[A-Z_]{1,40})").matcher(f);
            e.failure = m.find() ? m.group(1) : "other";
        }
    }

    private static Map<String, String> safeHeaders(Request req) {
        try {
            return req.allHeaders();
        } catch (RuntimeException ex) {
            return req.headers();
        }
    }

    private static boolean startsWith(byte[] b, String s) {
        if (b.length < s.length()) {
            return false;
        }
        for (int i = 0; i < s.length(); i++) {
            if (b[i] != s.charAt(i)) {
                return false;
            }
        }
        return true;
    }

    private static String names(Map<String, String> headers) {
        TreeSet<String> n = new TreeSet<>();
        for (String k : headers.keySet()) {
            n.add(NetworkMapRedaction.headerName(k));
        }
        return n.isEmpty() ? "-" : String.join(",", n);
    }

    /** The redacted lines, each starting with "NETMAP ". Safe to print in a public log. */
    synchronized List<String> lines() {
        List<String> out = new ArrayList<>();
        out.add("NETMAP begin entries=" + entries.size() + (dropped > 0 ? " dropped=" + dropped : ""));
        for (Entry e : entries) {
            StringBuilder sb = new StringBuilder("NETMAP ").append(e.n).append(" step=").append(e.step).append(' ')
                    .append(e.method).append(' ').append(e.host).append(e.path).append(e.query)
                    .append(" type=").append(e.resourceType)
                    .append(" status=").append(e.status < 0 ? "pending" : String.valueOf(e.status)).append(e.failure == null ? "" : " failed=" + e.failure)
                    .append(" ct=").append(e.contentType)
                    .append(" req-headers=").append(e.reqHeaders)
                    .append(" auth-scheme=").append(e.authScheme)
                    .append(" resp-headers=").append(e.respHeaders)
                    .append(" req-body=").append(e.reqBody)
                    .append(e.reqJwt ? " req-has-jwt=yes" : "")
                    .append(" resp-body=").append(e.respShape)
                    .append(e.respJwt ? " resp-has-jwt=yes" : "");
            out.add(sb.toString());
        }
        out.addAll(navs);
        for (var s : statics.entrySet()) {
            out.add("NETMAP static " + s.getKey() + " x" + s.getValue());
        }
        out.add("NETMAP end");
        return out;
    }
}
