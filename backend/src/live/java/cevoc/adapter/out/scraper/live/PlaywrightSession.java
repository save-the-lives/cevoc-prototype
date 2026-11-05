package cevoc.adapter.out.scraper.live;

import cevoc.adapter.out.scraper.EvidenceRateLimiter;
import cevoc.adapter.out.scraper.Redactor;
import cevoc.adapter.out.scraper.RenderedPageSession;
import cevoc.domain.CapturePath;
import cevoc.domain.ImageSize;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.LoadState;
import com.microsoft.playwright.options.WaitUntilState;
import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * One headless-browser session on the myPenalty Angular app. Selectors are deliberately tolerant (name, id and
 * formcontrolname for inputs; role/text for buttons), because the markup was inferred, not seen. Waits are polled
 * loops with a hard deadline; a timeout while waiting returns the current DOM (the parser decides what state it is),
 * a failing action raises an IOException whose message is first-line only and scrubbed of the notice, date and plate.
 * Nothing here logs.
 */
final class PlaywrightSession implements RenderedPageSession {

    static final String DEFAULT_PATH = "/customer_service/finesonline/";

    private static final String PNN = "input[name=\"pnn\"], input#pnn, input[formcontrolname=\"pnn\"]";
    private static final String DATE = "input[name=\"dateOfOffence\"], input#dateOfOffence, input[formcontrolname=\"dateOfOffence\"]";
    private static final String PLATE = "input[name=\"vehicleNumber\"], input#vehicleNumber, input[formcontrolname=\"vehicleNumber\"]";
    private static final String NEXT_CSS = "button:has-text(\"Next\"), input[type=\"submit\"][value=\"Next\"], a:has-text(\"Next\")";
    private static final String VIEW_CSS = "button:has-text(\"View images\"), input[type=\"submit\"][value*=\"View images\" i], a:has-text(\"View images\")";
    private static final String ERROR_CSS = "[role=\"alert\"], .alert-danger, .error, .has-error, .text-danger, .mat-error, .invalid-feedback";
    private static final String CERT_LINK_CSS = "a:has-text(\"View certification details\")";
    private static final String BLOB_IMG = "img[src^=\"blob:\"]";
    private static final Pattern SUMMARY_HEADING = Pattern.compile("Penalty Notice Number\\s*[-–:]\\s*\\w+");
    private static final String FETCH_JS = """
            async ([u, max]) => {
              const r = await fetch(u);
              if (!r.ok) return null;
              const b = await r.blob();
              if (b.size === 0 || b.size > max) return null;
              const type = b.type || r.headers.get('content-type') || '';
              const data = await new Promise((res, rej) => {
                const f = new FileReader();
                f.onload = () => res(String(f.result));
                f.onerror = () => rej(f.error);
                f.readAsDataURL(b);
              });
              return { type: type, b64: data.substring(data.indexOf(',') + 1) };
            }
            """;

    private final Playwright playwright;
    private final Browser browser;
    private final BrowserContext context;
    private final Page page;
    private final String loginUrl;
    private final long maxBytes;
    private final Duration stepTimeout;
    private final EvidenceRateLimiter limiter;
    private final HtmlCapture capture;
    private final Redactor redactor = new Redactor();

    private final boolean ownsBrowser;

    PlaywrightSession(Playwright playwright, Browser browser, BrowserContext context, URI baseUrl, long maxBytes,
                      Duration stepTimeout, EvidenceRateLimiter limiter, HtmlCapture capture, boolean ownsBrowser) {
        this.ownsBrowser = ownsBrowser;
        this.playwright = playwright;
        this.browser = browser;
        this.context = context;
        this.maxBytes = maxBytes;
        this.stepTimeout = stepTimeout;
        this.limiter = limiter;
        this.capture = capture;
        this.loginUrl = loginUrl(baseUrl);
        String host = baseUrl.getHost();
        // Top-level navigations may only stay on the configured host; everything else (scripts, XHR) passes.
        context.route("**/*", route -> {
            var req = route.request();
            boolean topNav = req.isNavigationRequest() && req.frame().parentFrame() == null;
            if (topNav && !sameHost(req.url(), host) && !certificateHost(req.url())) {
                abortedNavs.incrementAndGet();
                lastAbortedHost = hostClass(req.url());
                route.abort();
            } else if (wantsOriginalBody(req)) {
                countImageRequest(req.url());
                traceRequest(req);
                captureAndFulfil(route);
            } else {
                countImageRequest(req.url());
                traceRequest(req);
                route.resume();
            }
        });
        this.netmap = NetworkMapHolder.wanted() ? new NetworkMapRecorder() : null;
        if (netmap != null) {
            netmap.attach(context);
        }
        context.onResponse(resp -> {
            try {
                traceNetResponse(resp);
            } catch (RuntimeException ignored) {
                // diagnostics must never break the flow
            }
        });
        this.page = context.newPage();
        this.page.onDownload(this::countDownload);
        context.onPage(p -> p.onDownload(this::countDownload));
        // Diagnostics only: method and HTTP status of script-made POST/PUT calls, never URLs or bodies.
        this.page.onResponse(resp -> {
            try {
                String type = resp.request().resourceType();
                String method = resp.request().method();
                if (("xhr".equals(type) || "fetch".equals(type)) && !"GET".equals(method) && postStatuses.size() < 8) {
                    postStatuses.add(method + ":" + resp.status());
                }
            } catch (RuntimeException ignored) {
                // diagnostics must never break the flow
            }
        });
    }

    /**
     * One full-size image response taken at network level: its id (from the path, never logged), size word, content type and the
     * untouched body bytes as the driver received them (not text-decoded).
     */
    private record SeenImage(String id, String size, String contentType, byte[] body) {}

    private static final java.util.regex.Pattern IMAGE_PATH = java.util.regex.Pattern.compile("/images/([A-Za-z0-9_.-]{1,80})(?:[?#].*)?$");
    private static final java.util.regex.Pattern SIZE_PARAM = java.util.regex.Pattern.compile("[?&]size=([a-z]+)");
    private final java.util.List<SeenImage> seenImages = java.util.Collections.synchronizedList(new java.util.ArrayList<>());

    private final java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.atomic.AtomicInteger> imageRequests =
            new java.util.concurrent.ConcurrentHashMap<>();

    /** Diagnostics only: how many image requests of each size word the page has made (numbers, never addresses). */
    private void countImageRequest(String url) {
        if (IMAGE_PATH.matcher(url).find()) {
            var size = SIZE_PARAM.matcher(url);
            imageRequests.computeIfAbsent(size.find() ? size.group(1) : "full", k -> new java.util.concurrent.atomic.AtomicInteger()).incrementAndGet();
        }
    }

    /** True for the page's own GET of a full-size image from the source (no size word means full). Thumbnails and others pass untouched. */
    private static boolean wantsOriginalBody(com.microsoft.playwright.Request req) {
        if (!"GET".equals(req.method()) || req.isNavigationRequest()) {
            return false;
        }
        String url = req.url();
        if (!IMAGE_PATH.matcher(url).find()) {
            return false;
        }
        var size = SIZE_PARAM.matcher(url);
        return !size.find() || "full".equals(size.group(1));
    }

    /**
     * Sends the page's own request once (same URL, same headers the page set) from the driver, keeps the body bytes as received,
     * and hands the identical response back to the page so it behaves exactly as before. Nothing is added or forged.
     */
    private void captureAndFulfil(com.microsoft.playwright.Route route) {
        com.microsoft.playwright.APIResponse resp;
        try {
            resp = route.fetch();
        } catch (PlaywrightException e) {
            note("image-route-fetch=failed");
            safeAbort(route);
            return;
        }
        try {
            byte[] body = resp.body();
            String url = route.request().url();
            String type = String.valueOf(resp.headers().get("content-type")).toLowerCase(Locale.ROOT);
            traceResult(route.request(), "R", resp.status(), type, body == null ? -1 : body.length);
            var path = IMAGE_PATH.matcher(url);
            if (resp.status() == 200 && path.find() && type.startsWith("image/") && !type.contains("svg") && seenImages.size() < 60
                    && body != null && body.length <= maxBytes) {
                seenImages.add(new SeenImage(path.group(1), "full", type, body));
            } else {
                // Numbers and a type class only: why this full-size response was not kept.
                note("image-full-skipped=status:" + resp.status() + "/type:" + (type.startsWith("image/") ? type.substring(6) : type.isEmpty() ? "none"
                        : type.split("[/;]")[0]) + "/bytes:" + (body == null ? -1 : body.length) + "/kept:" + seenImages.size());
                if (resp.status() >= 400) {
                    imageRefusalProfile(route, resp, body);
                }
            }
        } catch (RuntimeException e) {
            // capture must never break the page
        }
        try {
            route.fulfill(new com.microsoft.playwright.Route.FulfillOptions().setResponse(resp));
        } catch (PlaywrightException e) {
            // the page navigated away mid-request
        }
    }


    // ---- redacted image-request trace (diagnostics only): order, shape, size word, status, type, bytes, header NAMES ----

    private static final java.util.regex.Pattern IDLIKE = java.util.regex.Pattern.compile("[A-Za-z0-9_-]{8,}");
    private final java.util.concurrent.atomic.AtomicInteger traceOrder = new java.util.concurrent.atomic.AtomicInteger();
    private final java.util.Map<String, Integer> traceIds = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.Map<Object, Integer> traceIndex = java.util.Collections.synchronizedMap(new java.util.IdentityHashMap<>());
    private final java.util.Map<String, String> traceHeaderSets = new java.util.concurrent.ConcurrentHashMap<>();
    private final java.util.List<String> traceLines = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
    private int traceEmitted;

    private static boolean imageish(String url) {
        try {
            String path = URI.create(url).getPath();
            return path != null && path.toLowerCase(Locale.ROOT).contains("image");
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Path with every id-like segment masked, e.g. /api/images/{id1}; never the id itself. */
    private String shapeOf(String url) {
        try {
            URI u = URI.create(url);
            String path = u.getPath() == null ? "" : u.getPath();
            StringBuilder sb = new StringBuilder();
            for (String seg : path.split("/")) {
                if (seg.isEmpty()) {
                    continue;
                }
                if (IDLIKE.matcher(seg).matches() && seg.chars().anyMatch(Character::isDigit)) {
                    Integer n = traceIds.get(seg);
                    if (n == null) {
                        n = traceIds.size() + 1;
                        traceIds.put(seg, n);
                    }
                    sb.append("/{id").append(n).append('}');
                } else {
                    sb.append('/').append(seg.length() > 24 ? "{long}" : seg.replaceAll("[^A-Za-z0-9_.-]", "_"));
                }
            }
            return sb.toString();
        } catch (RuntimeException e) {
            return "?";
        }
    }

    private static String sizeOf(String url) {
        var m = SIZE_PARAM.matcher(url);
        return m.find() ? m.group(1) : "none";
    }

    private String headerSet(java.util.Map<String, String> headers) {
        String names = headers.keySet().stream().map(k -> k.toLowerCase(Locale.ROOT)).sorted().collect(java.util.stream.Collectors.joining("|"));
        String letter = traceHeaderSets.get(names);
        if (letter == null) {
            letter = String.valueOf((char) ('A' + traceHeaderSets.size() % 26));
            traceHeaderSets.put(names, letter);
        }
        return letter;
    }

    private void traceRequest(com.microsoft.playwright.Request req) {
        if (traceOrder.get() < 60 && imageish(req.url())) {
            traceIndex.put(req, traceOrder.incrementAndGet());
        }
    }

    private void traceResult(com.microsoft.playwright.Request req, String via, int status, String type, int bytes) {
        Integer idx = traceIndex.get(req);
        if (idx == null || traceLines.size() >= 60) {
            return;
        }
        String t = type == null ? "none" : type.startsWith("image/") ? type.substring(6).split(";")[0] : type.split("[/;]")[0];
        traceLines.add("#" + idx + via + ":" + req.method() + shapeOf(req.url()) + "?size=" + sizeOf(req.url()) + "/" + status + "/" + t
                + "/" + bytes + "B/hdr" + headerSet(req.headers()) + "/" + req.resourceType());
    }

    private void traceNetResponse(com.microsoft.playwright.Response resp) {
        var req = resp.request();
        String type = String.valueOf(resp.headers().get("content-type")).toLowerCase(Locale.ROOT);
        if (traceIndex.containsKey(req)) {
            if (!wantsOriginalBody(req)) {
                String len = resp.headers().get("content-length");
                int bytes = -1;
                try {
                    bytes = len == null ? -1 : Integer.parseInt(len.trim());
                } catch (NumberFormatException ignored) {
                    // unknown length
                }
                traceResult(req, "N", resp.status(), type, bytes);
            }
        } else if (("xhr".equals(req.resourceType()) || "fetch".equals(req.resourceType())) && !type.startsWith("image/")) {
            scanForEmbeddedImage(req, resp, type);
        } else if (type.startsWith("image/") && !type.contains("svg") && traceOrder.get() < 60 && !"data".equals(req.resourceType())) {
            // An image-typed response whose path did not look like an image path: still shown, path shape masked.
            traceIndex.put(req, traceOrder.incrementAndGet());
            traceResult(req, "X", resp.status(), type, -1);
        }
    }

    /**
     * Counts, never content: whether a script-made response carries an image inside it (base64 PNG or JPEG signature, a data:image
     * prefix, or raw PNG/JPEG magic at the start). Only responses with a hit get a line.
     */
    private void scanForEmbeddedImage(com.microsoft.playwright.Request req, com.microsoft.playwright.Response resp, String type) {
        if (traceOrder.get() >= 60 || resp.status() >= 400) {
            return;
        }
        byte[] body;
        try {
            body = resp.body();
        } catch (RuntimeException e) {
            return;
        }
        if (body == null || body.length < 64 || body.length > 8_000_000) {
            return;
        }
        String text = new String(body, java.nio.charset.StandardCharsets.ISO_8859_1);
        int png = countOf(text, "iVBORw0KGgo");
        int jpg = countOf(text, "/9j/4AAQ");
        int dataImg = countOf(text, "data:image/");
        boolean rawMagic = looksLikeImage(body) && body[0] != '<';
        if (type.contains("json") && traceLines.size() < 50) {
            var names = new java.util.TreeSet<String>();
            var km = java.util.regex.Pattern.compile("\"([A-Za-z_]{2,40})\"\\s*:").matcher(text);
            while (km.find() && names.size() < 400) {
                String k = km.group(1);
                if (k.toLowerCase(Locale.ROOT).matches(".*(red|speed|limit|lane|yellow|direction|camera|banner|signal|phase|light).*")) {
                    names.add(k);
                }
            }
            if (!names.isEmpty()) {
                traceIndex.put(req, traceOrder.incrementAndGet());
                traceLines.add("#" + traceOrder.get() + "K:" + req.method() + shapeOf(req.url()) + "/" + resp.status() + "/" + body.length
                        + "B/keys=" + String.join(",", names));
            }
        }
        if (png + jpg + dataImg > 0 || rawMagic) {
            traceIndex.put(req, traceOrder.incrementAndGet());
            traceLines.add("#" + traceOrder.get() + "J:" + req.method() + shapeOf(req.url()) + "/" + resp.status() + "/"
                    + type.split("[/;]", 3)[type.contains("/") ? 1 : 0] + "/" + body.length + "B/png64=" + png + ",jpg64=" + jpg + ",dataimg="
                    + dataImg + ",raw=" + (rawMagic ? 1 : 0));
        }
    }

    private static int countOf(String text, String needle) {
        int n = 0;
        for (int i = text.indexOf(needle); i >= 0 && n < 99; i = text.indexOf(needle, i + needle.length())) {
            n++;
        }
        return n;
    }

    /** Emits trace lines not yet emitted, plus the header-name sets, as one fixed-shape marker. */
    private void emitTrace() {
        java.util.List<String> fresh;
        synchronized (traceLines) {
            fresh = new java.util.ArrayList<>(traceLines.subList(Math.min(traceEmitted, traceLines.size()), traceLines.size()));
            traceEmitted = traceLines.size();
        }
        if (fresh.isEmpty()) {
            return;
        }
        String sets = traceHeaderSets.entrySet().stream().map(e -> "hdr" + e.getValue() + "=" + e.getKey()).sorted()
                .collect(java.util.stream.Collectors.joining(","));
        note("img-trace=[" + String.join(" ; ", fresh) + "] " + sets);
    }

    private static void safeAbort(com.microsoft.playwright.Route route) {
        try {
            route.abort();
        } catch (PlaywrightException ignored) {
            // already handled or page closed
        }
    }

    private int fullCount() {
        synchronized (seenImages) {
            return (int) seenImages.stream().filter(i -> "full".equals(i.size())).count();
        }
    }

    /** Ids (never logged) of the full-size responses already given to an evidence item. */
    private final java.util.Set<String> claimed = new java.util.HashSet<>();

    /** The newest full-size response after the first {@code skip} ones that no item has taken yet; null when none. */
    private SeenImage unclaimedFull(int skip, boolean newest) {
        synchronized (seenImages) {
            var fulls = seenImages.stream().filter(i -> "full".equals(i.size())).toList();
            var open = new java.util.ArrayList<SeenImage>();
            for (int i = Math.max(0, skip); i < fulls.size(); i++) {
                if (!claimed.contains(fulls.get(i).id())) {
                    open.add(fulls.get(i));
                }
            }
            return open.isEmpty() ? null : newest ? open.get(open.size() - 1) : open.get(0);
        }
    }

    /** Polls until the condition holds or the bound passes (shorter than a step); never throws on timeout. */
    private boolean waitUpTo(java.time.Duration bound, java.util.function.BooleanSupplier condition) throws InterruptedException {
        long deadline = System.nanoTime() + bound.toNanos();
        while (System.nanoTime() < deadline) {
            if (Thread.currentThread().isInterrupted()) {
                throw new InterruptedException();
            }
            try {
                if (condition.getAsBoolean()) {
                    return true;
                }
            } catch (PlaywrightException ignored) {
                // mid-navigation
            }
            page.waitForTimeout(100);
        }
        return false;
    }

    /**
     * The original: the body of the source's full-size image response, untouched. A thumbnail in the strip is clicked so the
     * page asks for its full version, and we wait (condition-based, bounded) for that response. No re-encoding anywhere.
     */
    @Override
    public Optional<ImageBytes> originalImage(String ref, String blobUrl) throws IOException, InterruptedException {
        if (blobUrl == null || !blobUrl.startsWith("blob:")) {
            return Optional.empty();
        }
        return step("image-original", () -> {
            tag("capture-images");
            int[] dims = elementDims(blobUrl);
            SeenImage found = null;
            boolean thumbnail = dims[2] > 0 && dims[2] < 400;
            if (thumbnail) {
                int before = fullCount();
                try {
                    page.locator("img[src=\"" + blobUrl.replace("\"", "") + "\"]").first().click(new Locator.ClickOptions().setTimeout(5_000));
                    // The page asks for this frame's full version: wait (bounded) for a response nobody has taken yet. A frame whose
                    // full file was already loaded by the page is served from the browser cache and sends no new response; then the
                    // earliest response still unclaimed is the one.
                    waitUpTo(java.time.Duration.ofSeconds(4), () -> unclaimedFull(before, true) != null);
                } catch (PlaywrightException e) {
                    note("thumb-click=failed");
                }
                found = unclaimedFull(before, true);
                if (found == null) {
                    found = unclaimedFull(0, false);
                }
                if (found == null) {
                    // The page may already be showing this frame (a click on the selected frame asks for nothing). Select another
                    // frame and then this one again, as a person would, and wait once more for the page's own request.
                    int[] mark = {Integer.MAX_VALUE};
                    try {
                        var strip = page.locator("img[src^=\"blob:\"]");
                        int total = strip.count();
                        for (int i = 0; i < total; i++) {
                            String other = String.valueOf(strip.nth(i).getAttribute("src"));
                            if (!other.equals(blobUrl) && strip.nth(i).evaluate("el => el.naturalWidth").toString().matches("\\d{1,3}")) {
                                int pre = fullCount();
                                strip.nth(i).click(new Locator.ClickOptions().setTimeout(5_000));
                                waitUpTo(java.time.Duration.ofSeconds(3), () -> fullCount() > pre);
                                break;
                            }
                        }
                        int again = fullCount();
                        mark[0] = again;
                        page.locator("img[src=\"" + blobUrl.replace("\"", "") + "\"]").first().click(new Locator.ClickOptions().setTimeout(5_000));
                        waitUpTo(java.time.Duration.ofSeconds(4), () -> fullCount() > again);
                        note("image-retry-fulls=" + (fullCount() - again));
                    } catch (PlaywrightException e) {
                        note("thumb-retry=failed");
                    }
                    found = unclaimedFull(mark[0], true);
                }
                note("image-requests=" + imageRequests.entrySet().stream().map(e -> e.getKey() + ":" + e.getValue()).sorted()
                        .collect(java.util.stream.Collectors.joining(",")) + "; fulls-seen=" + fullCount());
            } else {
                // The large image: its full response was seen while the page loaded.
                found = unclaimedFull(0, false);
            }
            emitTrace();
            if (found != null) {
                claimed.add(found.id());
            }
            if (found == null) {
                note("image-path=response-missing");
                return Optional.<ImageBytes>empty();
            }
            byte[] body = found.body();
            note("image-body-first=" + String.format("%02x%02x%02x", body[0] & 0xff, body[1] & 0xff, body[2] & 0xff) + "/" + body.length);
            String type = found.contentType().split(";")[0].trim();
            if (body.length == 0 || body.length > maxBytes || !looksLikeImage(body)) {
                note("image-path=response-unusable");
                return Optional.<ImageBytes>empty();
            }
            note("image-path=response");
            return Optional.of(new ImageBytes(type, body, sized(dims, CapturePath.RESPONSE)));
        });
    }

    /** File-signature check only: JPEG, PNG, GIF, WebP/RIFF, BMP or an XML/SVG start. */
    static boolean looksLikeImage(byte[] b) {
        if (b == null || b.length < 4) {
            return false;
        }
        int a = b[0] & 0xff, c = b[1] & 0xff;
        return (a == 0xff && c == 0xd8) || (a == 0x89 && c == 0x50) || (a == 'G' && c == 'I') || (a == 'R' && c == 'I')
                || (a == 'B' && c == 'M') || a == '<';
    }

    private volatile String lastAbortedHost = "none";
    private final java.util.concurrent.atomic.AtomicInteger downloads = new java.util.concurrent.atomic.AtomicInteger();
    private volatile String downloadKind = "none";

    /** Diagnostics only: a download started in the browser. Only the file extension class is kept, never the name. */
    private void countDownload(com.microsoft.playwright.Download d) {
        downloads.incrementAndGet();
        String n = String.valueOf(d.suggestedFilename()).toLowerCase(Locale.ROOT);
        downloadKind = n.endsWith(".pdf") ? "pdf" : n.endsWith(".html") || n.endsWith(".htm") ? "html" : n.endsWith(".jsf") ? "jsf" : "other";
    }

    private final java.util.concurrent.atomic.AtomicInteger abortedNavs = new java.util.concurrent.atomic.AtomicInteger();
    private final NetworkMapRecorder netmap;

    private void tag(String label) {
        if (netmap != null) {
            netmap.step(label);
        }
    }

    private final java.util.List<String> postStatuses = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
    private static final String[] ALERT_WORDS = {"not found", "no match", "incorrect", "invalid", "captcha", "robot", "try again",
            "unable", "error", "required", "does not match", "not recognised", "verify"};

    static String loginUrl(URI base) {
        String path = base.getPath();
        if (path == null || path.isBlank() || "/".equals(path)) {
            return URI.create(base.getScheme() + "://" + base.getAuthority() + DEFAULT_PATH).toString();
        }
        return base.toString();
    }

    /** Government host names only (they are not secrets); any other host is reported as "other". */
    static String hostClass(String url) {
        try {
            String h = String.valueOf(URI.create(url).getHost()).toLowerCase(Locale.ROOT);
            return h.endsWith(".nsw.gov.au") && h.length() <= 60 && h.matches("[a-z0-9.-]+") ? h : "other";
        } catch (IllegalArgumentException e) {
            return "other";
        }
    }

    /** The certificates site lives under the Transport for NSW domain; the certification link may lead there. */
    static boolean certificateHost(String url) {
        try {
            String h = URI.create(url).getHost();
            return h != null && ("transport.nsw.gov.au".equalsIgnoreCase(h) || h.toLowerCase(Locale.ROOT).endsWith(".transport.nsw.gov.au"));
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    static boolean sameHost(String url, String host) {
        try {
            String h = URI.create(url).getHost();
            return h != null && h.equalsIgnoreCase(host);
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    @Override
    public String loginPage() throws IOException, InterruptedException {
        return step("login", () -> {
            tag("open-login");
            pace();
            page.navigate(loginUrl, new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));
            // Ready as soon as both inputs are there; no waiting for the network to go quiet.
            waitUntil(() -> page.locator(PNN).count() > 0 && page.locator(DATE).count() > 0);
            return snapshot("1-login");
        });
    }

    @Override
    public String submitLogin(String noticeNumber, String offenceDate) throws IOException, InterruptedException {
        redactor.add(noticeNumber);
        redactor.add(offenceDate);
        return step("submit-login", () -> {
            tag("submit-login");
            fill(PNN, noticeNumber);
            fill(DATE, offenceDate);
            pace();
            markFilled(noticeNumber, offenceDate);
            click(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Next").setExact(true)),
                    page.locator(NEXT_CSS));
            markAfterClick();
            // Hidden alert templates exist on the login page from the start, so only a VISIBLE alert counts, and the
            // login inputs disappearing (the app moved on) counts too.
            waitUntil(() -> page.locator(PLATE).count() > 0 || page.getByText(SUMMARY_HEADING).count() > 0
                    || page.locator(PNN).count() == 0 || visibleAlerts() > 0);
            tag("read-summary");
            return snapshot("2-after-login");
        });
    }

    @Override
    public java.util.Optional<String> currentPage() throws IOException, InterruptedException {
        return step("read-summary", () -> java.util.Optional.of(snapshot("2-after-login")));
    }

    @Override
    public String submitPlate(String registration) throws IOException, InterruptedException {
        redactor.add(registration);
        return step("submit-plate", () -> {
            tag("give-plate");
            fill(PLATE, registration);
            pace();
            cevoc.adapter.out.scraper.LookupDiagnostic.note("plate-kept="
                    + (registration.equals(page.locator(PLATE).first().inputValue()) ? "yes" : "no")
                    + "; view-buttons=" + Math.min(page.locator(VIEW_CSS).count(), 9)
                    + "; view-disabled=" + (page.locator(VIEW_CSS).count() > 0 && page.locator(VIEW_CSS).first().isDisabled() ? "yes" : "no"));
            tag("view-images");
            click(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("View images")),
                    page.locator(VIEW_CSS));
            cevoc.adapter.out.scraper.LookupDiagnostic.note("view-clicked=yes");
            // Thumbnails are blob: images. A visible error with the plate field still present ends the wait early.
            waitUntil(() -> page.locator(BLOB_IMG).count() > 0
                    || (page.locator(PLATE).count() > 0 && visibleAlerts() > 0));
            // Let the rest of the thumbnails arrive: done as soon as the count has been the same for two short looks (bounded).
            int last = -1;
            int same = 0;
            for (int i = 0; i < 30 && same < 2; i++) {
                int now = page.locator(BLOB_IMG).count();
                same = now == last ? same + 1 : 0;
                last = now;
                if (same < 2) {
                    page.waitForTimeout(250);
                }
            }
            cevoc.adapter.out.scraper.LookupDiagnostic.note("blob-imgs-live=" + Math.min(page.locator(BLOB_IMG).count(), 40)
                    + "; alerts-visible=" + visibleAlerts() + "; alert-words=" + alertWords() + "; post-calls=" + String.join(",", postStatuses));
            tag("capture-images");
            return snapshot("3-after-plate");
        });
    }

    @Override
    public Optional<String> openCertification() throws IOException, InterruptedException {
        return step("certificates", () -> {
            tag("certificates");
            Locator link = page.locator(CERT_LINK_CSS);
            if (link.count() == 0) {
                note("cert-link=absent");
                return Optional.<String>empty();
            }
            certStatus = 0;
            Locator first = link.first();
            String abs = null;
            try {
                Object o = first.evaluate("a => a.href");
                abs = o instanceof String h && h.startsWith("https://") ? h : null;
            } catch (PlaywrightException e) {
                abs = null;
            }
            note("cert-link-count=" + Math.min(link.count(), 9) + "; cert-href-absolute=" + (abs != null ? "yes" : "no")
                    + "; cert-href-host=" + (abs == null ? "none" : hostClass(abs)));
            if (abs != null) {
                redactor.add(abs); // the link carries a signed value: scrub it from any error text
                Optional<String> viaGoto = gotoPath(abs);
                if (viaGoto.isPresent()) {
                    note("cert-path=goto");
                    return viaGoto;
                }
                Optional<String> viaFetch = fetchPath(abs);
                if (viaFetch.isPresent()) {
                    note("cert-path=fetch");
                    return viaFetch;
                }
            }
            if (certStatus == 401 || certStatus == 403 || certStatus == 429) {
                // The address answered but refused us: clicking would only repeat the request.
                throw new PlaywrightException("blocked-" + certStatus);
            }
            note("cert-path=click");
            return clickPath();
        });
    }

    /** Opens the certification address in a fresh tab of the SAME context (cookies shared). Empty on any failure. */
    private Optional<String> gotoPath(String url) throws InterruptedException {
        pace();
        Page np = context.newPage();
        try {
            // Ordinary browser courtesy only: where the visitor came from and the language. The identifying
            // user agent of this application is NOT changed.
            np.setExtraHTTPHeaders(Map.of("Accept-Language", "en-AU,en;q=0.9"));
            String from = page.url();
            String referer = from.startsWith("https://") ? from.substring(0, from.indexOf('/', 8) < 0 ? from.length() : from.indexOf('/', 8)) + "/" : null;
            Page.NavigateOptions nav = new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED).setTimeout(45_000);
            if (referer != null) {
                nav.setReferer(referer);
            }
            com.microsoft.playwright.Response r = np.navigate(url, nav);
            int status = r == null ? 0 : r.status();
            certStatus = status;
            String ct = r == null ? "" : String.valueOf(r.headers().get("content-type")).toLowerCase(Locale.ROOT);
            note("cert-goto-status=" + status + "; cert-goto-type=" + (ct.contains("html") ? "html" : ct.isEmpty() ? "none" : "other"));
            try {
                np.waitForLoadState(LoadState.NETWORKIDLE, new Page.WaitForLoadStateOptions().setTimeout(10_000));
            } catch (PlaywrightException ignored) {
                // carry on with what is rendered
            }
            String html = null;
            for (int i = 0; i < 4 && html == null; i++) {
                try {
                    html = np.content();
                } catch (PlaywrightException e) {
                    np.waitForTimeout(1500);
                }
            }
            if (html == null || status >= 400 || !ct.contains("html")) {
                note("cert-goto=unusable");
                if (r != null && status >= 400) {
                    note("cert-goto-header-names=" + headerNames(r.headers().keySet()));
                }
                if (html != null && status >= 400) {
                    note("cert-goto-body: " + cevoc.adapter.out.scraper.LookupDiagnostic.certPageStructureOf(html));
                }
                return Optional.empty();
            }
            if (capture != null) {
                capture.save("4-certificates", html);
            }
            return Optional.of(html);
        } catch (PlaywrightException e) {
            note("cert-goto=failed; cert-goto-cause=" + causeToken(e) + "; cert-nav-aborted-host=" + lastAbortedHost);
            return Optional.empty();
        } finally {
            try {
                np.close();
            } catch (PlaywrightException ignored) {
                // already closed
            }
        }
    }

    /** In-page fetch of the same address with the session's cookies. Empty on any failure (CORS included). */
    private Optional<String> fetchPath(String url) throws InterruptedException {
        pace();
        try {
            Object o = page.evaluate("""
                    async u => {
                      const r = await fetch(u, {credentials: 'include'});
                      const t = await r.text();
                      return {status: r.status, type: r.headers.get('content-type') || '', text: t.length > 2000000 ? '' : t};
                    }
                    """, url);
            if (o instanceof Map<?, ?> m && m.get("text") instanceof String t) {
                Object st = m.get("status");
                if (st instanceof Number sn) {
                    certStatus = sn.intValue();
                }
                String ct = String.valueOf(m.get("type")).toLowerCase(Locale.ROOT);
                note("cert-fetch-status=" + st + "; cert-fetch-type=" + (ct.contains("html") ? "html" : ct.isEmpty() ? "none" : "other"));
                if (st instanceof Number n && n.intValue() < 400 && ct.contains("html") && !t.isBlank()) {
                    if (capture != null) {
                        capture.save("4-certificates", t);
                    }
                    return Optional.of(t);
                }
            }
            note("cert-fetch=unusable");
        } catch (PlaywrightException e) {
            note("cert-fetch=failed; cert-fetch-cause=" + causeToken(e));
        }
        return Optional.empty();
    }

    private volatile int certStatus;

    private static final java.util.Set<String> HEADER_VOCAB = java.util.Set.of("server", "x-cache", "cf-ray", "x-azure-ref", "x-ms-request-id",
            "via", "set-cookie", "cache-control", "content-type", "content-length", "location", "www-authenticate", "retry-after",
            "x-served-by", "x-amz-cf-id", "x-request-id", "x-iinfo", "x-frame-options", "strict-transport-security", "content-security-policy");

    /** Response header NAMES from a fixed vocabulary (never values); the rest are only counted. */
    private static String headerNames(java.util.Set<String> names) {
        java.util.TreeSet<String> known = new java.util.TreeSet<>();
        int other = 0;
        for (String n : names) {
            String l = n.toLowerCase(Locale.ROOT);
            if (HEADER_VOCAB.contains(l)) {
                known.add(l);
            } else {
                other++;
            }
        }
        return String.join(",", known) + (other > 0 ? ",other*" + Math.min(other, 99) : "");
    }

    private String causeToken(PlaywrightException e) {
        String r = cevoc.adapter.out.scraper.LookupDiagnostic
                .fromFailure("browser step 'x' failed: " + redactor.clean(e.getMessage()));
        return r.substring(r.indexOf("cause=") + 6);
    }

    /** Last resort: click the link and read the tab or page it opens. */
    private Optional<String> clickPath() throws Exception {
        {
            Locator link = page.locator(CERT_LINK_CSS);
            if (link.count() == 0) {
                note("cert-link=absent");
                return Optional.<String>empty();
            }
            pace();
            java.util.concurrent.atomic.AtomicReference<Page> opened = new java.util.concurrent.atomic.AtomicReference<>();
            java.util.function.Consumer<Page> onOpen = opened::set;
            String before = page.url();
            int abortedBefore = abortedNavs.get();
            Locator first = link.first();
            String target = String.valueOf(first.getAttribute("target")).toLowerCase(Locale.ROOT);
            String href = first.getAttribute("href");
            note("cert-link-count=" + Math.min(link.count(), 9) + "; cert-link-visible=" + (first.isVisible() ? "yes" : "no")
                    + "; cert-link-href=" + (href == null || href.isBlank() ? "no" : href.startsWith("#") ? "hash" : href.toLowerCase(Locale.ROOT).startsWith("javascript") ? "js" : "yes")
                    + "; cert-link-target=" + (target.equals("_blank") ? "blank" : target.equals("null") ? "none" : "other"));
            context.onPage(onOpen);
            try {
                try {
                    first.click(new Locator.ClickOptions().setTimeout(10_000));
                    note("cert-click=normal");
                } catch (PlaywrightException e) {
                    note("cert-click=normal-failed; cert-nav-aborted-host=" + lastAbortedHost);
                    try {
                        first.dispatchEvent("click");
                        note("cert-click=dispatch");
                    } catch (PlaywrightException e2) {
                        note("cert-click=dispatch-failed; cert-nav-aborted-host=" + lastAbortedHost
                                + "; cert-popup-after-click=" + (opened.get() != null ? "yes" : "no"));
                        waitUntil(() -> opened.get() != null || !before.equals(page.url()) || downloads.get() > 0);
                        note("cert-downloads=" + Math.min(downloads.get(), 9) + "; cert-download-kind=" + downloadKind
                                + "; cert-pages=" + Math.min(context.pages().size(), 9)
                                + "; cert-popup-late=" + (opened.get() != null ? "yes" : "no")
                                + "; cert-url-changed-late=" + (before.equals(page.url()) ? "no" : "yes"));
                        if (opened.get() == null && before.equals(page.url())) {
                            throw downloads.get() > 0 ? new PlaywrightException("download started") : e2;
                        }
                    }
                }
                waitUntil(() -> opened.get() != null || !before.equals(page.url()));
            } finally {
                context.offPage(onOpen);
            }
            Page dest = opened.get() != null ? opened.get() : page;
            // A new tab starts as about:blank and then navigates: wait until it has a real address.
            waitUntil(() -> {
                String u = dest.url();
                return u != null && !u.isBlank() && !"about:blank".equals(u);
            });
            try {
                dest.waitForLoadState(LoadState.DOMCONTENTLOADED, new Page.WaitForLoadStateOptions().setTimeout(stepTimeout.toMillis()));
                dest.waitForLoadState(LoadState.NETWORKIDLE,
                        new Page.WaitForLoadStateOptions().setTimeout(Math.min(10_000, stepTimeout.toMillis())));
            } catch (PlaywrightException ignored) {
                // carry on with what is rendered
            }
            String url = dest.url();
            note("cert-link=present; cert-popup=" + (opened.get() != null ? "yes" : "no")
                    + "; cert-url-host=" + hostKind(url) + "; cert-nav-aborted=" + Math.min(abortedNavs.get() - abortedBefore, 9)
                    + "; cert-path-jsf=" + (url.toLowerCase(Locale.ROOT).contains(".jsf") ? "yes" : "no")
                    + "; cert-url-changed=" + (before.equals(url) ? "no" : "yes"));
            String html = null;
            for (int i = 0; i < 6 && html == null; i++) {
                try {
                    html = dest.content();
                } catch (PlaywrightException e) {
                    // "page is navigating": let it finish, then read again
                    note("cert-content-retry=" + (i + 1));
                    dest.waitForTimeout(1500);
                    try {
                        dest.waitForLoadState(LoadState.DOMCONTENTLOADED, new Page.WaitForLoadStateOptions().setTimeout(5_000));
                    } catch (PlaywrightException ignored) {
                        // keep trying
                    }
                }
            }
            if (html == null) {
                html = dest.content();
            }
            if (capture != null) {
                capture.save("4-certificates", html);
            }
            return Optional.of(html);
        }
    }

    /** Redacted facts about the refusal (header names, size bucket, client category); see SearchPageDiagnostic. */
    private void refusalProfile(com.microsoft.playwright.Response r, String body) {
        String label = "srch-refusal-profile";
        try {
            java.util.Map<String, String> headers = java.util.Map.of();
            java.util.Map<String, String> sent = java.util.Map.of();
            if (r != null) {
                try {
                    headers = r.allHeaders();
                } catch (RuntimeException e) {
                    headers = r.headers();
                }
                try {
                    sent = r.request().allHeaders();
                } catch (RuntimeException e) {
                    sent = r.request().headers();
                }
            }
            note(cevoc.adapter.out.scraper.SearchPageDiagnostic.refusalProfile(label, "same", headers,
                    body == null ? 0 : body.length(), body != null && body.toLowerCase(Locale.ROOT).contains("<html"),
                    (headless ? "headless-chromium" : "headed-chromium"), "custom-identifying",
                    containsKeyIgnoreCase(sent, "referer"), containsKeyIgnoreCase(sent, "origin")));
        } catch (RuntimeException e) {
            note(cevoc.adapter.out.scraper.SearchPageDiagnostic.refusalProfileUnavailable(label, e));
        }
    }

    private static boolean containsKeyIgnoreCase(java.util.Map<String, String> m, String key) {
        return m.keySet().stream().anyMatch(k -> k != null && k.equalsIgnoreCase(key));
    }

    /** same | revenue-nsw-api | other: host category of a request URL (never the URL). */
    private String requestHostCategory(String url) {
        try {
            String host = URI.create(url).getHost();
            if (host == null) return "other";
            if (sameHost(url, URI.create(loginUrl).getHost())) return "same";
            return host.toLowerCase(Locale.ROOT).endsWith("osr.nsw.gov.au") ? "revenue-nsw-api" : "other";
        } catch (RuntimeException e) {
            return "other";
        }
    }

    private volatile boolean imageRefusalNoted;

    /** Once per session: header names, size bucket and host category of a refused image request. */
    private void imageRefusalProfile(com.microsoft.playwright.Route route, com.microsoft.playwright.APIResponse resp, byte[] body) {
        String label = "image-refusal-profile";
        if (imageRefusalNoted) return;
        imageRefusalNoted = true;
        try {
            java.util.Map<String, String> sent = route.request().headers();
            String text = body == null ? "" : new String(body, 0, Math.min(body.length, 4096), java.nio.charset.StandardCharsets.ISO_8859_1).toLowerCase(Locale.ROOT);
            note(cevoc.adapter.out.scraper.SearchPageDiagnostic.refusalProfile(label, requestHostCategory(route.request().url()),
                    resp.headers(), body == null ? 0 : body.length, text.contains("<html") || text.contains("<body"),
                    (headless ? "headless-chromium" : "headed-chromium") + "-route-fetch", "custom-identifying",
                    containsKeyIgnoreCase(sent, "referer"), containsKeyIgnoreCase(sent, "origin")));
        } catch (RuntimeException e) {
            note(cevoc.adapter.out.scraper.SearchPageDiagnostic.refusalProfileUnavailable(label, e));
        }
    }

    private volatile boolean headless = true;

    void headless(boolean value) {
        this.headless = value;
    }

    /** same | transport | other | blank: where the page is, as a token (never the URL). */
    private String hostKind(String url) {
        if (url == null || url.isBlank() || "about:blank".equals(url)) {
            return "blank";
        }
        return sameHost(url, URI.create(loginUrl).getHost()) ? "same" : certificateHost(url) ? "transport" : "other";
    }

    // ---- certificates SEARCH page (interim provider search-page; owner-approved 2026-11-04) ----

    private static final java.time.format.DateTimeFormatter SEARCH_FORMAT = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final String TEXT_INPUTS = "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=image])";
    private static final String SEARCH_BUTTON_CSS = "button:has-text(\"Search\"), input[type=\"submit\"][value*=\"search\" i], input[type=\"button\"][value*=\"search\" i], a:has-text(\"Search\")";
    private static final String RESULT_MESSAGES = ".ui-messages-error, .ui-message-error, .ui-messages-warn, .ui-messages-info, .ui-growl-message, [role=\"alert\"], .alert";

    @Override
    public Optional<String> searchCertificates(String pageUrl, String locationCode, java.time.LocalDateTime from,
                                               java.time.LocalDateTime to) throws IOException, InterruptedException {
        String fromText = SEARCH_FORMAT.format(from);
        String toText = SEARCH_FORMAT.format(to);
        redactor.add(locationCode);
        redactor.add(fromText);
        redactor.add(toText);
        return step("certificates", () -> {
            tag("certificates");
            java.util.List<String> statuses = java.util.Collections.synchronizedList(new java.util.ArrayList<>());
            java.util.concurrent.atomic.AtomicLong postSeenAt = new java.util.concurrent.atomic.AtomicLong();
            java.util.function.Consumer<com.microsoft.playwright.Response> listener = resp -> {
                try {
                    String type = resp.request().resourceType();
                    String method = resp.request().method();
                    if ("document".equals(type) || "xhr".equals(type) || "fetch".equals(type)) {
                        if (statuses.size() < 10) {
                            statuses.add(type.substring(0, 1) + ":" + method + ":" + resp.status());
                        }
                        if (!"GET".equals(method)) {
                            postSeenAt.compareAndSet(0, System.nanoTime());
                        }
                    }
                } catch (RuntimeException ignored) {
                    // diagnostics must never break the flow
                }
            };
            page.onResponse(listener);
            try {
                pace();
                com.microsoft.playwright.Response r = page.navigate(pageUrl,
                        new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));
                int status = r == null ? 0 : r.status();
                note("srch-open-status=" + status + "; srch-open-host=" + hostKind(page.url()));
                if (status == 401 || status == 403 || status == 429) {
                    // Refused: structure of the refusal page only, then stop. No second attempt, no other route.
                    note("srch-refusal-page: " + cevoc.adapter.out.scraper.SearchPageDiagnostic.structureOf(page.content()));
                    refusalProfile(r, page.content());
                    throw new PlaywrightException("blocked-" + status);
                }
                settle();
                String openHtml = snapshot("5-search-form");
                note("srch-form: " + cevoc.adapter.out.scraper.SearchPageDiagnostic.structureOf(openHtml));
                if (status >= 400) {
                    throw new PlaywrightException("search page answered status " + status);
                }
                if (cevoc.adapter.out.scraper.SearchPageDiagnostic.hasCaptcha(openHtml)) {
                    throw new PlaywrightException("captcha present: stopping, not automating past it");
                }
                Locator loc = searchField("loc", "location\\s*code", "location code",
                        "input[id*=\"location\" i], input[name*=\"location\" i]", 0);
                Locator dFrom = searchField("from", "(time|date)\\s*from|\\bfrom\\b", "from",
                        "input[id*=\"from\" i], input[name*=\"from\" i], input[id*=\"start\" i]", 1);
                Locator dTo = searchField("to", "(time|date)\\s*to\\b", null,
                        "input[id*=\"dateto\" i], input[id*=\"timeto\" i], input[id$=\"to\" i], input[name$=\"to\" i], input[id*=\":to\" i]", 2);
                if (loc == null || dFrom == null || dTo == null) {
                    throw new PlaywrightException("no-search-form: fields not found");
                }
                boolean locKept = fillSearch(loc, locationCode);
                boolean fromKept = fillSearch(dFrom, fromText);
                boolean toKept = fillSearch(dTo, toText);
                note("srch-kept=" + (locKept ? "yes" : "no") + "/" + (fromKept ? "yes" : "no") + "/" + (toKept ? "yes" : "no")
                        + "; srch-invalid-before=" + Math.min(page.locator("[aria-invalid=\"true\"], .ui-state-error").count(), 9));
                Locator button = page.getByRole(AriaRole.BUTTON,
                        new Page.GetByRoleOptions().setName(Pattern.compile("^\\s*search\\s*$", Pattern.CASE_INSENSITIVE)));
                String buttonBy = "role";
                if (button.count() == 0) {
                    button = page.locator(SEARCH_BUTTON_CSS);
                    buttonBy = "css";
                }
                note("srch-button-by=" + (button.count() == 0 ? "none" : buttonBy) + "; srch-buttons=" + Math.min(button.count(), 9));
                if (button.count() == 0) {
                    throw new PlaywrightException("no matching button on the page");
                }
                pace();
                statuses.clear();
                button.first().click();
                settle();
                waitUntil(() -> searchResultReady(postSeenAt));
                settle();
                note("srch-calls=" + (statuses.isEmpty() ? "none" : String.join(",", statuses)) + "; srch-after-host=" + hostKind(page.url()));
                String resultHtml = snapshot("6-search-result");
                note("srch-result: " + cevoc.adapter.out.scraper.SearchPageDiagnostic.structureOf(resultHtml));
                return Optional.of(resultHtml);
            } catch (RuntimeException e) {
                // Redacted: class name plus up to 10 short lowercase words of the message (letters only, so no digits, codes or URLs).
                String m = redactor.clean(String.valueOf(e.getMessage())).toLowerCase(Locale.ROOT);
                note("srch-error=" + e.getClass().getSimpleName() + "/words:" + java.util.Arrays.stream(m.replaceAll("[^a-z ]", " ").trim().split("\\s+"))
                        .filter(w -> w.length() >= 2 && w.length() <= 14).limit(10).collect(java.util.stream.Collectors.joining("-")));
                throw e;
            } finally {
                page.offResponse(listener);
            }
        });
    }

    /** A results table header, an empty-result marker, a visible message, or a post that has had a few seconds to render. */
    private boolean searchResultReady(java.util.concurrent.atomic.AtomicLong postSeenAt) {
        if (page.locator("th:has-text(\"Description\"), .ui-datatable-empty-message, .no-results").count() > 0) {
            return true;
        }
        for (Locator m : page.locator(RESULT_MESSAGES).all()) {
            if (m.isVisible() && !m.innerText().isBlank()) {
                return true;
            }
        }
        long seen = postSeenAt.get();
        return seen != 0 && System.nanoTime() - seen > 5_000_000_000L;
    }

    /**
     * Finds one of the three search inputs: by label, then by id/name fragment, then by the text of a neighbouring
     * label, then by position among the visible text inputs. Records which way worked (never a value).
     */
    private Locator searchField(String what, String labelRegex, String neighbourText, String css, int ordinal) {
        Locator byLabel = page.getByLabel(Pattern.compile(labelRegex, Pattern.CASE_INSENSITIVE));
        if (byLabel.count() == 1 && "input".equals(String.valueOf(byLabel.first().evaluate("e => e.tagName.toLowerCase()")))) {
            note("srch-" + what + "-by=label");
            return byLabel.first();
        }
        Locator byCss = page.locator(css);
        if (byCss.count() >= 1) {
            note("srch-" + what + "-by=css; srch-" + what + "-css-matches=" + Math.min(byCss.count(), 9));
            return byCss.first();
        }
        if (neighbourText != null) {
            Locator near = page.locator("xpath=//*[self::td or self::th or self::label or self::span][contains(translate(normalize-space(string(.)),"
                    + "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'" + neighbourText + "')]/following::input[not(@type='hidden')][1]");
            if (near.count() >= 1) {
                note("srch-" + what + "-by=neighbour");
                return near.first();
            }
        }
        Locator visible = page.locator(TEXT_INPUTS);
        if (visible.count() > ordinal) {
            note("srch-" + what + "-by=order; srch-text-inputs=" + Math.min(visible.count(), 9));
            return visible.nth(ordinal);
        }
        note("srch-" + what + "-by=none; srch-text-inputs=" + Math.min(visible.count(), 9));
        return null;
    }

    /** Types into a search input, blurs it so the page registers the value, and reports whether the value stayed as typed. */
    private boolean fillSearch(Locator input, String value) {
        input.fill(value);
        if (!value.equals(input.inputValue())) {
            input.clear();
            input.pressSequentially(value, new Locator.PressSequentiallyOptions().setDelay(60));
        }
        input.press("Tab");
        return value.equals(input.inputValue());
    }

    @Override
    public Optional<ImageBytes> imageBytes(String blobUrl) throws IOException, InterruptedException {
        if (blobUrl == null || !blobUrl.startsWith("blob:")) {
            return Optional.empty();
        }
        // In-page fetch of a blob: URL: no request to the site, so no pacing needed.
        return step("image", () -> {
            tag("capture-images");
            // 1) in-page fetch of the blob; 2) draw the loaded img onto a canvas; 3) screenshot the element.
            int[] dims = elementDims(blobUrl); // rendered w,h and natural w,h of the img element: numbers only
            try {
                Object o = page.evaluate(FETCH_JS, Arrays.asList(blobUrl, (double) maxBytes));
                if (o instanceof Map<?, ?> m && m.get("b64") instanceof String b64 && !b64.isEmpty()) {
                    String type = m.get("type") instanceof String t ? t.toLowerCase(Locale.ROOT) : "";
                    note("image-path=fetch");
                    return Optional.of(new ImageBytes(type, Base64.getDecoder().decode(b64), sized(dims, CapturePath.FETCH)));
                }
                note("fetch=empty");
            } catch (PlaywrightException e) {
                String m = String.valueOf(e.getMessage()).toLowerCase(Locale.ROOT);
                note("fetch=failed" + (m.contains("content security policy") ? "-csp" : m.contains("failed to fetch") ? "-typeerror" : "-other")
                        + "/reason:" + (m.contains("revoked") || m.contains("not found") || m.contains("404") ? "gone" : m.contains("context was destroyed") ? "navigated"
                        : m.contains("timeout") ? "timeout" : m.contains("too large") ? "large" : "unclassified")
                        + "/msg-words:" + java.util.Arrays.stream(m.replaceAll("[^a-z ]", " ").trim().split("\\s+")).limit(8)
                        .filter(w -> w.length() <= 14).collect(java.util.stream.Collectors.joining("-")));
            }
            Locator img = page.locator("img[src=\"" + blobUrl.replace("\"", "") + "\"]").first();
            try {
                Object o = img.evaluate(CANVAS_JS);
                if (o instanceof String d && d.startsWith("data:image/png;base64,")) {
                    note("image-path=canvas");
                    return Optional.of(new ImageBytes("image/png", Base64.getDecoder().decode(d.substring(d.indexOf(',') + 1)),
                            sized(dims, CapturePath.CANVAS)));
                }
                note("canvas=empty");
            } catch (PlaywrightException e) {
                note("canvas=failed");
            }
            try {
                byte[] png = img.screenshot();
                if (png != null && png.length > 0 && png.length <= maxBytes) {
                    note("image-path=shot");
                    return Optional.of(new ImageBytes("image/png", png, sized(dims, CapturePath.SCREENSHOT)));
                }
                note("shot=empty");
            } catch (PlaywrightException e) {
                note("shot=failed");
            }
            return Optional.<ImageBytes>empty();
        });
    }

    private static final String DIMS_JS = "el => [el.clientWidth, el.clientHeight, el.naturalWidth, el.naturalHeight]";

    /** {renderedW, renderedH, naturalW, naturalH} of the img element showing this blob; zeros when unavailable. */
    private int[] elementDims(String blobUrl) {
        int[] out = new int[4];
        try {
            Object o = page.locator("img[src=\"" + blobUrl.replace("\"", "") + "\"]").first().evaluate(DIMS_JS);
            if (o instanceof java.util.List<?> l && l.size() == 4) {
                for (int i = 0; i < 4; i++) {
                    out[i] = l.get(i) instanceof Number n ? (int) Math.max(0, Math.min(n.longValue(), 100_000)) : 0;
                }
            }
        } catch (PlaywrightException ignored) {
            // numbers are optional
        }
        return out;
    }

    /** Pixel size defaults to the natural size (fetch, canvas) or the rendered size (screenshot); the adapter refines it from the bytes. */
    private static ImageSize sized(int[] d, CapturePath path) {
        boolean shot = path == CapturePath.SCREENSHOT;
        return new ImageSize(shot ? d[0] : d[2], shot ? d[1] : d[3], d[0], d[1], d[2], d[3], 0, path);
    }

    private static void note(String marker) {
        cevoc.adapter.out.scraper.LookupDiagnostic.note(marker);
    }

    private static final String CANVAS_JS = """
            el => {
              if (!el.complete || !el.naturalWidth) return null;
              const c = document.createElement('canvas');
              c.width = el.naturalWidth; c.height = el.naturalHeight;
              c.getContext('2d').drawImage(el, 0, 0);
              return c.toDataURL('image/png');
            }
            """;

    @Override
    public void close() {
        if (netmap != null) {
            NetworkMapHolder.deposit(netmap.lines());
        }
        redactor.clear();
        // A warm browser outlives the lookup: only this lookup's context (cookies, storage, pages) is closed.
        PlaywrightSessionFactory.closeQuietly(context, ownsBrowser ? browser : null, ownsBrowser ? playwright : null);
    }

    // ---- helpers ----

    @FunctionalInterface
    private interface Action<T> {
        T run() throws Exception;
    }

    private <T> T step(String name, Action<T> action) throws IOException, InterruptedException {
        try {
            return action.run();
        } catch (InterruptedException e) {
            throw e;
        } catch (PlaywrightException e) {
            throw new IOException("browser step '" + name + "' failed: " + redactor.clean(e.getMessage()));
        } catch (IOException | RuntimeException e) {
            throw new IOException("browser step '" + name + "' failed: " + e.getClass().getSimpleName());
        } catch (Exception e) {
            throw new IOException("browser step '" + name + "' failed: " + e.getClass().getSimpleName());
        }
    }

    private void pace() throws InterruptedException {
        try {
            limiter.acquire();
        } catch (IllegalStateException e) {
            throw new InterruptedException("interrupted while pacing");
        }
    }

    /** Fills a field; if the app's input mask changes the value, retype it slowly. Never reports the value. */
    private void fill(String selector, String value) {
        Locator input = page.locator(selector).first();
        input.waitFor();
        input.fill(value);
        if (!value.equals(input.inputValue())) {
            input.clear();
            input.pressSequentially(value, new Locator.PressSequentiallyOptions().setDelay(60));
        }
    }

    /** Diagnostics only: yes/no markers about the filled form, never the values. */
    private void markFilled(String notice, String date) {
        try {
            cevoc.adapter.out.scraper.LookupDiagnostic.note("pnn-kept="
                    + (notice.equals(page.locator(PNN).first().inputValue()) ? "yes" : "no")
                    + "; date-kept=" + (date.equals(page.locator(DATE).first().inputValue()) ? "yes" : "no")
                    + "; next-count=" + Math.min(page.locator(NEXT_CSS).count(), 9)
                    + "; next-disabled=" + (page.locator(NEXT_CSS).count() > 0 && page.locator(NEXT_CSS).first().isDisabled() ? "yes" : "no")
                    + "; invalid-before=" + Math.min(page.locator(".ng-invalid, [aria-invalid=\"true\"]").count(), 9));
        } catch (RuntimeException e) {
            cevoc.adapter.out.scraper.LookupDiagnostic.note("markers-before=unreadable");
        }
    }

    private void markAfterClick() {
        try {
            cevoc.adapter.out.scraper.LookupDiagnostic.note("alerts-after=" + Math.min(page.locator(ERROR_CSS).count(), 9)
                    + "; invalid-after=" + Math.min(page.locator(".ng-invalid, [aria-invalid=\"true\"]").count(), 9)
                    + "; path-changed=" + (page.url().contains(DEFAULT_PATH) ? "no" : "yes")
                    + "; hash-changed=" + (page.url().contains("#") ? "yes" : "no")
                    + "; post-calls=" + (postStatuses.isEmpty() ? "none" : String.join(",", postStatuses))
                    + "; iframe-kinds=" + iframeKinds()
                    + "; alert-visible=" + visibleAlerts()
                    + "; alert-words=" + alertWords());
        } catch (RuntimeException e) {
            cevoc.adapter.out.scraper.LookupDiagnostic.note("markers-after=unreadable");
        }
    }

    private String iframeKinds() {
        java.util.TreeSet<String> kinds = new java.util.TreeSet<>();
        for (Locator f : page.locator("iframe").all()) {
            String src = String.valueOf(f.getAttribute("src")).toLowerCase(Locale.ROOT);
            kinds.add(src.contains("recaptcha") ? "recaptcha" : src.contains("google") ? "google" : src.contains("hcaptcha") ? "hcaptcha" : "other");
        }
        return kinds.isEmpty() ? "none" : String.join(",", kinds);
    }

    private int visibleAlerts() {
        int n = 0;
        for (Locator a : page.locator(ERROR_CSS).all()) {
            if (a.isVisible() && !a.innerText().isBlank()) {
                n++;
            }
        }
        return Math.min(n, 9);
    }

    /** Which words of a fixed vocabulary appear in the visible alert text. The text itself is never kept. */
    private String alertWords() {
        StringBuilder text = new StringBuilder();
        for (Locator a : page.locator(ERROR_CSS).all()) {
            if (a.isVisible()) {
                text.append(a.innerText().toLowerCase(Locale.ROOT)).append(' ');
            }
        }
        java.util.List<String> hit = new java.util.ArrayList<>();
        for (String w : ALERT_WORDS) {
            if (text.indexOf(w) >= 0) {
                hit.add(w.replace(' ', '-'));
            }
        }
        return hit.isEmpty() ? "none" : String.join(",", hit);
    }

    /** Clicks the first candidate that exists; throws if none does. */
    private void click(Locator... candidates) {
        for (Locator c : candidates) {
            if (c.count() > 0) {
                c.first().click();
                return;
            }
        }
        throw new PlaywrightException("no matching button on the page");
    }

    /** Waits for the network to go quiet, but an app that polls forever must not hold us up. */
    private void settle() {
        try {
            page.waitForLoadState(LoadState.NETWORKIDLE,
                    new Page.WaitForLoadStateOptions().setTimeout(Math.min(10_000, stepTimeout.toMillis())));
        } catch (PlaywrightException ignored) {
            // timed out: carry on with what is rendered
        }
    }

    /** Polls until the condition holds or the step deadline passes. Returns whether it held; never throws on timeout. */
    private boolean waitUntil(java.util.function.BooleanSupplier condition) throws InterruptedException {
        long deadline = System.nanoTime() + stepTimeout.toNanos();
        while (System.nanoTime() < deadline) {
            if (Thread.currentThread().isInterrupted()) {
                throw new InterruptedException();
            }
            try {
                if (condition.getAsBoolean()) {
                    return true;
                }
            } catch (PlaywrightException ignored) {
                // page is mid-navigation; look again
            }
            page.waitForTimeout(150);
        }
        return false;
    }

    private String snapshot(String stepName) {
        String html = page.content();
        if (capture != null) {
            capture.save(stepName, html);
        }
        return html;
    }
}
