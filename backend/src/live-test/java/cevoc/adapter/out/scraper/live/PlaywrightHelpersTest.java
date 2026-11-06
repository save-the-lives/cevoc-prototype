package cevoc.adapter.out.scraper.live;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.scraper.ScraperSettings;
import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;

/** Runs only with -Plive-browser. Pure helpers; launches no browser and makes no network call. */
class PlaywrightHelpersTest {

    @Test
    void loginUrlAppendsTheAppPathOnlyWhenTheBaseHasNone() {
        assertThat(PlaywrightSession.loginUrl(URI.create("https://penalty.example.invalid")))
                .isEqualTo("https://penalty.example.invalid/customer_service/finesonline/");
        assertThat(PlaywrightSession.loginUrl(URI.create("https://penalty.example.invalid/")))
                .isEqualTo("https://penalty.example.invalid/customer_service/finesonline/");
        assertThat(PlaywrightSession.loginUrl(URI.create("https://penalty.example.invalid/customer_service/finesonline/")))
                .isEqualTo("https://penalty.example.invalid/customer_service/finesonline/");
    }

    @Test
    void onlyTheConfiguredHostIsAllowedForTopLevelNavigation() {
        assertThat(PlaywrightSession.sameHost("https://penalty.example.invalid/x", "penalty.example.invalid")).isTrue();
        assertThat(PlaywrightSession.sameHost("https://PENALTY.example.invalid/x", "penalty.example.invalid")).isTrue();
        assertThat(PlaywrightSession.sameHost("https://other.example.invalid/x", "penalty.example.invalid")).isFalse();
        assertThat(PlaywrightSession.sameHost("not a url", "penalty.example.invalid")).isFalse();
    }

    @Test
    void stepTimeoutIsGenerousButBounded() {
        ScraperSettings s = ScraperSettings.off();
        assertThat(PlaywrightSessionFactory.stepTimeout(s)).isEqualTo(Duration.ofSeconds(45));
        ScraperSettings tiny = new ScraperSettings("", "", Duration.ZERO, Duration.ZERO, Duration.ofSeconds(1), Duration.ZERO, 1);
        ScraperSettings huge = new ScraperSettings("", "", Duration.ZERO, Duration.ZERO, Duration.ofMinutes(10), Duration.ZERO, 1);
        assertThat(PlaywrightSessionFactory.stepTimeout(tiny)).isEqualTo(Duration.ofSeconds(30));
        assertThat(PlaywrightSessionFactory.stepTimeout(huge)).isEqualTo(Duration.ofSeconds(90));
    }

    @Test
    void certificatesSessionContextDiffersFromThePenaltyOneOnlyByTheUserAgent() {
        ScraperSettings s = new ScraperSettings("https://penalty.example.invalid/", "test-contact@example.invalid", Duration.ZERO,
                Duration.ZERO, Duration.ofSeconds(15), Duration.ZERO, 1);
        var penalty = PlaywrightSessionFactory.contextOptions(s, false);
        var certificates = PlaywrightSessionFactory.contextOptions(s, true);
        assertThat(penalty.userAgent).isEqualTo(s.userAgent());
        // The browser's own agent: nothing is set, so Chromium sends its real one. No header is added.
        assertThat(certificates.userAgent).isNull();
        assertThat(certificates.extraHTTPHeaders).isNull();
        assertThat(certificates.locale).isEqualTo(penalty.locale).isEqualTo("en-AU");
        assertThat(certificates.timezoneId).isEqualTo(penalty.timezoneId);
        assertThat(certificates.acceptDownloads).isEqualTo(penalty.acceptDownloads);
        assertThat(certificates.serviceWorkers).isEqualTo(penalty.serviceWorkers);
        assertThat(penalty.extraHTTPHeaders).isNull();
    }

    @Test
    void certificatesContextUserAgentIsTheHeadedChromeOneAndNeverHeadless() {
        ScraperSettings s = ScraperSettings.off();
        var certificates = PlaywrightSessionFactory.contextOptions(s, true, "131.0.6778.33");
        assertThat(certificates.userAgent)
                .isNotNull()
                .doesNotContain("Headless")
                .contains("Chrome/131.0.6778.33")
                .startsWith("Mozilla/5.0 (");
        assertThat(PlaywrightSessionFactory.headedUserAgent("131.0.6778.33", "Linux"))
                .isEqualTo("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.6778.33 Safari/537.36");
        // The penalty lookup keeps the identifying agent whatever the browser version.
        assertThat(PlaywrightSessionFactory.contextOptions(s, false, "131.0.6778.33").userAgent).isEqualTo(s.userAgent());
    }

    @Test
    void certificatesBrowserUsesStandardHeadlessAndHidesWebdriver() {
        var certs = PlaywrightSessionFactory.launchOptions(true, true);
        assertThat(certs.headless).isTrue();
        assertThat(certs.args).isNullOrEmpty();
        // Penalty lookup launch is unchanged: plain Playwright headless, no extra args.
        var penalty = PlaywrightSessionFactory.launchOptions(true, false);
        assertThat(penalty.headless).isTrue();
        assertThat(penalty.args).isNullOrEmpty();
        // The script run before any page makes navigator.webdriver read false.
        assertThat(PlaywrightSessionFactory.WEBDRIVER_INIT_SCRIPT)
                .contains("navigator", "'webdriver'", "get: () => false");
        ScraperSettings s = ScraperSettings.off();
        var c = PlaywrightSessionFactory.contextOptions(s, true, "131.0.6778.33");
        assertThat(c.viewportSize).isPresent();
        assertThat(c.viewportSize.get().width).isEqualTo(1920);
        assertThat(c.viewportSize.get().height).isEqualTo(1080);
        assertThat(c.locale).isEqualTo("en-AU");
        assertThat(c.timezoneId).isEqualTo("Australia/Sydney");
        assertThat(PlaywrightSessionFactory.contextOptions(s, false).viewportSize).isNull();
    }
}
