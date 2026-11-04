package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import au.gov.nsw.transport.cevoc.adapter.out.scraper.EvidenceRateLimiter;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.Redactor;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.RenderedPageSession;
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

    PlaywrightSession(Playwright playwright, Browser browser, BrowserContext context, URI baseUrl, long maxBytes,
                      Duration stepTimeout, EvidenceRateLimiter limiter, HtmlCapture capture) {
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
                route.abort();
            } else {
                route.resume();
            }
        });
        this.page = context.newPage();
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

    private final java.util.concurrent.atomic.AtomicInteger abortedNavs = new java.util.concurrent.atomic.AtomicInteger();
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
            pace();
            page.navigate(loginUrl, new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));
            waitUntil(() -> page.locator(PNN).count() > 0 && page.locator(DATE).count() > 0);
            settle();
            return snapshot("1-login");
        });
    }

    @Override
    public String submitLogin(String noticeNumber, String offenceDate) throws IOException, InterruptedException {
        redactor.add(noticeNumber);
        redactor.add(offenceDate);
        return step("submit-login", () -> {
            fill(PNN, noticeNumber);
            fill(DATE, offenceDate);
            pace();
            markFilled(noticeNumber, offenceDate);
            click(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Next").setExact(true)),
                    page.locator(NEXT_CSS));
            settle();
            markAfterClick();
            // Hidden alert templates exist on the login page from the start, so only a VISIBLE alert counts, and the
            // login inputs disappearing (the app moved on) counts too.
            waitUntil(() -> page.locator(PLATE).count() > 0 || page.getByText(SUMMARY_HEADING).count() > 0
                    || page.locator(PNN).count() == 0 || visibleAlerts() > 0);
            return snapshot("2-after-login");
        });
    }

    @Override
    public String submitPlate(String registration) throws IOException, InterruptedException {
        redactor.add(registration);
        return step("submit-plate", () -> {
            fill(PLATE, registration);
            pace();
            au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note("plate-kept="
                    + (registration.equals(page.locator(PLATE).first().inputValue()) ? "yes" : "no")
                    + "; view-buttons=" + Math.min(page.locator(VIEW_CSS).count(), 9)
                    + "; view-disabled=" + (page.locator(VIEW_CSS).count() > 0 && page.locator(VIEW_CSS).first().isDisabled() ? "yes" : "no"));
            click(page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("View images")),
                    page.locator(VIEW_CSS));
            settle();
            au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note("view-clicked=yes");
            // Thumbnails are blob: images. A visible error with the plate field still present ends the wait early.
            waitUntil(() -> page.locator(BLOB_IMG).count() > 0
                    || (page.locator(PLATE).count() > 0 && visibleAlerts() > 0));
            // Let the rest of the thumbnails arrive: wait for the count to stop changing (bounded).
            int last = -1;
            for (int i = 0; i < 6; i++) {
                int now = page.locator(BLOB_IMG).count();
                if (now == last) {
                    break;
                }
                last = now;
                page.waitForTimeout(1500);
            }
            au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note("blob-imgs-live=" + Math.min(page.locator(BLOB_IMG).count(), 40)
                    + "; alerts-visible=" + visibleAlerts() + "; alert-words=" + alertWords() + "; post-calls=" + String.join(",", postStatuses));
            return snapshot("3-after-plate");
        });
    }

    @Override
    public Optional<String> openCertification() throws IOException, InterruptedException {
        return step("certificates", () -> {
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
            context.onPage(onOpen);
            try {
                link.first().click();
                waitUntil(() -> opened.get() != null || !before.equals(page.url()));
            } finally {
                context.offPage(onOpen);
            }
            Page target = opened.get() != null ? opened.get() : page;
            try {
                target.waitForLoadState(LoadState.DOMCONTENTLOADED, new Page.WaitForLoadStateOptions().setTimeout(stepTimeout.toMillis()));
                target.waitForLoadState(LoadState.NETWORKIDLE,
                        new Page.WaitForLoadStateOptions().setTimeout(Math.min(10_000, stepTimeout.toMillis())));
            } catch (PlaywrightException ignored) {
                // carry on with what is rendered
            }
            String url = target.url();
            note("cert-link=present; cert-popup=" + (opened.get() != null ? "yes" : "no")
                    + "; cert-url-host=" + hostKind(url) + "; cert-nav-aborted=" + Math.min(abortedNavs.get() - abortedBefore, 9)
                    + "; cert-path-jsf=" + (url.toLowerCase(Locale.ROOT).contains(".jsf") ? "yes" : "no")
                    + "; cert-url-changed=" + (before.equals(url) ? "no" : "yes"));
            String html = target.content();
            if (capture != null) {
                capture.save("4-certificates", html);
            }
            return Optional.of(html);
        });
    }

    /** same | transport | other | blank: where the page is, as a token (never the URL). */
    private String hostKind(String url) {
        if (url == null || url.isBlank() || "about:blank".equals(url)) {
            return "blank";
        }
        return sameHost(url, URI.create(loginUrl).getHost()) ? "same" : certificateHost(url) ? "transport" : "other";
    }

    @Override
    public Optional<ImageBytes> imageBytes(String blobUrl) throws IOException, InterruptedException {
        if (blobUrl == null || !blobUrl.startsWith("blob:")) {
            return Optional.empty();
        }
        // In-page fetch of a blob: URL: no request to the site, so no pacing needed.
        return step("image", () -> {
            // 1) in-page fetch of the blob; 2) draw the loaded img onto a canvas; 3) screenshot the element.
            try {
                Object o = page.evaluate(FETCH_JS, Arrays.asList(blobUrl, maxBytes));
                if (o instanceof Map<?, ?> m && m.get("b64") instanceof String b64 && !b64.isEmpty()) {
                    String type = m.get("type") instanceof String t ? t.toLowerCase(Locale.ROOT) : "";
                    note("image-path=fetch");
                    return Optional.of(new ImageBytes(type, Base64.getDecoder().decode(b64)));
                }
                note("fetch=empty");
            } catch (PlaywrightException e) {
                String m = String.valueOf(e.getMessage()).toLowerCase(Locale.ROOT);
                note("fetch=failed" + (m.contains("content security policy") ? "-csp" : m.contains("failed to fetch") ? "-typeerror" : "-other"));
            }
            Locator img = page.locator("img[src=\"" + blobUrl.replace("\"", "") + "\"]").first();
            try {
                Object o = img.evaluate(CANVAS_JS);
                if (o instanceof String d && d.startsWith("data:image/png;base64,")) {
                    note("image-path=canvas");
                    return Optional.of(new ImageBytes("image/png", Base64.getDecoder().decode(d.substring(d.indexOf(',') + 1))));
                }
                note("canvas=empty");
            } catch (PlaywrightException e) {
                note("canvas=failed");
            }
            try {
                byte[] png = img.screenshot();
                if (png != null && png.length > 0 && png.length <= maxBytes) {
                    note("image-path=shot");
                    return Optional.of(new ImageBytes("image/png", png));
                }
                note("shot=empty");
            } catch (PlaywrightException e) {
                note("shot=failed");
            }
            return Optional.<ImageBytes>empty();
        });
    }

    private static void note(String marker) {
        au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note(marker);
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
        redactor.clear();
        PlaywrightSessionFactory.closeQuietly(context, browser, playwright);
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
            au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note("pnn-kept="
                    + (notice.equals(page.locator(PNN).first().inputValue()) ? "yes" : "no")
                    + "; date-kept=" + (date.equals(page.locator(DATE).first().inputValue()) ? "yes" : "no")
                    + "; next-count=" + Math.min(page.locator(NEXT_CSS).count(), 9)
                    + "; next-disabled=" + (page.locator(NEXT_CSS).count() > 0 && page.locator(NEXT_CSS).first().isDisabled() ? "yes" : "no")
                    + "; invalid-before=" + Math.min(page.locator(".ng-invalid, [aria-invalid=\"true\"]").count(), 9));
        } catch (RuntimeException e) {
            au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note("markers-before=unreadable");
        }
    }

    private void markAfterClick() {
        try {
            au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note("alerts-after=" + Math.min(page.locator(ERROR_CSS).count(), 9)
                    + "; invalid-after=" + Math.min(page.locator(".ng-invalid, [aria-invalid=\"true\"]").count(), 9)
                    + "; path-changed=" + (page.url().contains(DEFAULT_PATH) ? "no" : "yes")
                    + "; hash-changed=" + (page.url().contains("#") ? "yes" : "no")
                    + "; post-calls=" + (postStatuses.isEmpty() ? "none" : String.join(",", postStatuses))
                    + "; iframe-kinds=" + iframeKinds()
                    + "; alert-visible=" + visibleAlerts()
                    + "; alert-words=" + alertWords());
        } catch (RuntimeException e) {
            au.gov.nsw.transport.cevoc.adapter.out.scraper.LookupDiagnostic.note("markers-after=unreadable");
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
            page.waitForTimeout(400);
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
