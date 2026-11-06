package cevoc.adapter.out.scraper.live;

import cevoc.adapter.out.scraper.EvidenceRateLimiter;
import cevoc.adapter.out.scraper.RenderedPageSession;
import cevoc.adapter.out.scraper.RenderedPageSessionFactory;
import cevoc.adapter.out.scraper.ScraperSettings;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.PlaywrightException;
import com.microsoft.playwright.options.ServiceWorkerPolicy;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Path;
import java.time.Duration;

/**
 * Real {@link RenderedPageSessionFactory} using Playwright for Java (headless Chromium). Compiled only with the
 * live-browser Maven profile; created by name from ScraperEvidenceFactory, and only when
 * cevoc.scraper.evidence.browser=playwright and the scraper flags are on.
 *
 * One Playwright + browser + context per session, all closed in {@link PlaywrightSession#close}. The pacing
 * limiter is shared by all sessions of this factory, so requests stay slow even across lookups.
 */
public final class PlaywrightSessionFactory implements RenderedPageSessionFactory {

    private final ScraperSettings settings;
    private final Path captureDir;
    private final boolean headless;
    private final EvidenceRateLimiter limiter;
    private final boolean reuseBrowser;
    private final boolean browserDefaultUserAgent;

    /** A started Playwright driver and Chromium, kept for the next lookup on the same thread (Playwright is thread-confined). */
    private record Holder(Playwright playwright, Browser browser) {}

    private static final int MAX_WARM = 2;
    private final java.util.Map<Thread, Holder> warm = new java.util.concurrent.ConcurrentHashMap<>();

    /** @param captureDir where to save the raw rendered HTML of each step, or blank for none (owner's local check) */
    public PlaywrightSessionFactory(ScraperSettings settings, String captureDir, boolean headless) {
        this(settings, captureDir, headless, false);
    }

    /**
     * @param reuseBrowser keep the Chromium process warm between lookups made on the same thread. Every lookup still gets a
     *                     brand-new browser context (no cookies, storage or cache carried over, closed at the end), so nothing
     *                     is shared between people; only the started browser process is.
     */
    public PlaywrightSessionFactory(ScraperSettings settings, String captureDir, boolean headless, boolean reuseBrowser) {
        this(settings, captureDir, headless, reuseBrowser, false);
    }

    /**
     * @param browserDefaultUserAgent send the browser's OWN user agent (Playwright's Chromium default, nothing set by us) instead of
     *                                the identifying one. Used only for the certificates search page, whose bot management refuses
     *                                the identifying agent (owner-approved 2026-11-07). Everything else about the context is identical.
     */
    public PlaywrightSessionFactory(ScraperSettings settings, String captureDir, boolean headless, boolean reuseBrowser,
                                    boolean browserDefaultUserAgent) {
        this.browserDefaultUserAgent = browserDefaultUserAgent;
        this.reuseBrowser = reuseBrowser;
        this.settings = settings;
        this.captureDir = captureDir == null || captureDir.isBlank() ? null : Path.of(captureDir);
        this.headless = headless;
        this.limiter = EvidenceRateLimiter.system(settings.minInterval());
    }

    @Override
    public RenderedPageSession open(URI baseUrl) throws IOException {
        Playwright playwright = null;
        Browser browser = null;
        BrowserContext context = null;
        boolean owns = true;
        try {
            Holder held = reuseBrowser ? warmHolder() : null;
            owns = held == null;
            if (held != null) {
                playwright = held.playwright();
                browser = held.browser();
            } else {
                playwright = Playwright.create();
                browser = playwright.chromium().launch(launchOptions(headless, browserDefaultUserAgent));
            }
            context = browser.newContext(contextOptions(settings, browserDefaultUserAgent, browser.version()));
            if (browserDefaultUserAgent) {
                context.addInitScript(WEBDRIVER_INIT_SCRIPT);
            }
            Duration step = stepTimeout(settings);
            context.setDefaultTimeout(step.toMillis());
            context.setDefaultNavigationTimeout(step.toMillis());
            PlaywrightSession session = new PlaywrightSession(playwright, browser, context, baseUrl, settings.maxBytes(), step, limiter,
                    captureDir == null ? null : new HtmlCapture(captureDir), owns);
            session.headless(headless);
            session.userAgentCategory(browserDefaultUserAgent ? "browser-default" : "custom-identifying");
            return session;
        } catch (RuntimeException e) {
            if (!owns) {
                forgetWarm();
            }
            closeQuietly(context, owns ? browser : null, owns ? playwright : null);
            // First line only, no cause: nothing about the target should leak from here.
            throw new IOException("could not start the browser: " + firstLine(e.getMessage()));
        }
    }

    /**
     * The warm browser of this thread, started if needed; null when this thread has none and enough others are held (it then
     * uses a throw-away browser like before). A browser that has gone away is replaced.
     */
    private Holder warmHolder() {
        Thread t = Thread.currentThread();
        warm.keySet().removeIf(th -> !th.isAlive());
        Holder h = warm.get(t);
        if (h != null && h.browser().isConnected()) {
            return h;
        }
        if (h != null) {
            forgetWarm();
        }
        if (warm.size() >= MAX_WARM) {
            return null;
        }
        Playwright p = Playwright.create();
        try {
            Browser b = p.chromium().launch(launchOptions(headless, browserDefaultUserAgent));
            h = new Holder(p, b);
            warm.put(t, h);
            return h;
        } catch (RuntimeException e) {
            closeQuietly(null, null, p);
            throw e;
        }
    }

    private void forgetWarm() {
        Holder h = warm.remove(Thread.currentThread());
        if (h != null) {
            closeQuietly(null, h.browser(), h.playwright());
        }
    }

    /**
     * The one place the browser context is configured, for every session. The identifying user agent is set unless
     * {@code browserDefaultUserAgent}; that is the only difference between the penalty lookup and the certificates search page.
     * No header is added or faked: cookies, Accept, Accept-Language and Sec-Fetch-* come from Chromium itself.
     */
    static Browser.NewContextOptions contextOptions(ScraperSettings settings, boolean browserDefaultUserAgent) {
        return contextOptions(settings, browserDefaultUserAgent, null);
    }

    /**
     * @param browserVersion the launched Chromium's version (browser.version()). Headless Chromium's default agent contains
     *                       "HeadlessChrome", which the certificates page's bot management refuses. For the browser-default case the
     *                       agent is therefore the one this same Chromium sends when headed: identical, minus the word "Headless".
     */
    static Browser.NewContextOptions contextOptions(ScraperSettings settings, boolean browserDefaultUserAgent, String browserVersion) {
        var o = new Browser.NewContextOptions()
                .setLocale("en-AU")
                .setTimezoneId("Australia/Sydney")
                .setAcceptDownloads(false)
                .setServiceWorkers(ServiceWorkerPolicy.BLOCK);
        if (browserDefaultUserAgent) {
            // Certificates only: a desktop-sized window, as a real browser session has.
            o.setViewportSize(1920, 1080);
        }
        if (!browserDefaultUserAgent) {
            o.setUserAgent(settings.userAgent());
        } else if (browserVersion != null && !browserVersion.isBlank()) {
            o.setUserAgent(headedUserAgent(browserVersion, System.getProperty("os.name", "")));
        }
        return o;
    }

    /** The user agent of this Chromium build when run headed (same string headless sends, without "Headless"). */
    static String headedUserAgent(String chromiumVersion, String osName) {
        String os = osName == null ? "" : osName.toLowerCase(java.util.Locale.ROOT);
        String platform = os.contains("win") ? "Windows NT 10.0; Win64; x64"
                : os.contains("mac") ? "Macintosh; Intel Mac OS X 10_15_7"
                : "X11; Linux x86_64";
        return "Mozilla/5.0 (" + platform + ") AppleWebKit/537.36 (KHTML, like Gecko) Chrome/" + chromiumVersion.trim()
                + " Safari/537.36";
    }

    /** Generous but bounded: three times the HTTP request timeout, between 30 and 90 seconds. */
    static Duration stepTimeout(ScraperSettings s) {
        Duration d = s.requestTimeout().multipliedBy(3);
        if (d.compareTo(Duration.ofSeconds(30)) < 0) {
            return Duration.ofSeconds(30);
        }
        return d.compareTo(Duration.ofSeconds(90)) > 0 ? Duration.ofSeconds(90) : d;
    }

    static void closeQuietly(BrowserContext context, Browser browser, Playwright playwright) {
        try {
            if (context != null) context.close();
        } catch (RuntimeException ignored) {
            // best effort
        }
        try {
            if (browser != null) browser.close();
        } catch (RuntimeException ignored) {
            // best effort
        }
        try {
            if (playwright != null) playwright.close();
        } catch (RuntimeException ignored) {
            // best effort
        }
    }

    private static String firstLine(String m) {
        return m == null ? "" : m.lines().findFirst().orElse("");
    }

    /**
     * In the container image (env CEVOC_BROWSER_CONTAINER=true) Chromium cannot create its own sandbox, so the container is the
     * sandbox and /dev/shm is small; the flags below are added only there. Local runs are unchanged.
     */
    static BrowserType.LaunchOptions launchOptions(boolean headless) {
        return launchOptions(headless, false);
    }

    /** Runs before any page script in the certificates context: navigator.webdriver reads false, not Playwright's true. */
    static final String WEBDRIVER_INIT_SCRIPT = "Object.defineProperty(navigator, 'webdriver', {get: () => false});";

    /**
     * @param newHeadless certificates browser only: run Chrome's new headless implementation, which shares the headed browser's
     *                    DOM/JS fingerprint. Playwright's headless(true) selects the OLD headless mode, so for this case Playwright is
     *                    told headed (setHeadless(false)) and "--headless=new" is passed as an argument, when headless was wanted.
     */
    static BrowserType.LaunchOptions launchOptions(boolean headless, boolean newHeadless) {
        var args = new java.util.ArrayList<String>();
        var o = new BrowserType.LaunchOptions();
        if (newHeadless && headless) {
            o.setHeadless(false);
            args.add("--headless=new");
            args.add("--disable-gpu");
            args.add("--no-sandbox");
        } else {
            o.setHeadless(headless);
        }
        if ("true".equalsIgnoreCase(System.getenv("CEVOC_BROWSER_CONTAINER"))) {
            for (String a : new String[] {"--no-sandbox", "--disable-dev-shm-usage"}) {
                if (!args.contains(a)) args.add(a);
            }
        }
        if (!args.isEmpty()) {
            o.setArgs(args);
        }
        return o;
    }
}
