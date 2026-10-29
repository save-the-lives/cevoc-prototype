package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.adapter.out.scraper.ScraperSettings;
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
        ScraperSettings tiny = new ScraperSettings(true, "", "", Duration.ZERO, Duration.ZERO, Duration.ofSeconds(1), Duration.ZERO, 1);
        ScraperSettings huge = new ScraperSettings(true, "", "", Duration.ZERO, Duration.ZERO, Duration.ofMinutes(10), Duration.ZERO, 1);
        assertThat(PlaywrightSessionFactory.stepTimeout(tiny)).isEqualTo(Duration.ofSeconds(30));
        assertThat(PlaywrightSessionFactory.stepTimeout(huge)).isEqualTo(Duration.ofSeconds(90));
    }
}
