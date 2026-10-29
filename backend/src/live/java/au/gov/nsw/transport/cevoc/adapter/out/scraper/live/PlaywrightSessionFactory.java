package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import au.gov.nsw.transport.cevoc.adapter.out.scraper.EvidenceRateLimiter;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.RenderedPageSession;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.RenderedPageSessionFactory;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.ScraperSettings;
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

    /** @param captureDir where to save the raw rendered HTML of each step, or blank for none (owner's local check) */
    public PlaywrightSessionFactory(ScraperSettings settings, String captureDir, boolean headless) {
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
        try {
            playwright = Playwright.create();
            browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setHeadless(headless));
            context = browser.newContext(new Browser.NewContextOptions()
                    .setUserAgent(settings.userAgent())
                    .setLocale("en-AU")
                    .setTimezoneId("Australia/Sydney")
                    .setAcceptDownloads(false)
                    .setServiceWorkers(ServiceWorkerPolicy.BLOCK));
            Duration step = stepTimeout(settings);
            context.setDefaultTimeout(step.toMillis());
            context.setDefaultNavigationTimeout(step.toMillis());
            return new PlaywrightSession(playwright, browser, context, baseUrl, settings.maxBytes(), step, limiter,
                    captureDir == null ? null : new HtmlCapture(captureDir));
        } catch (PlaywrightException | RuntimeException e) {
            closeQuietly(context, browser, playwright);
            // First line only, no cause: nothing about the target should leak from here.
            throw new IOException("could not start the browser: " + firstLine(e.getMessage()));
        }
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
}
