package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assumptions.assumeThat;

import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The profile-free parts of the live browser feature: wiring switches, plate scoping and message scrubbing. No browser, no network. */
class LiveBrowserWiringTest {

    private static final String BASE = "https://penalty.example.invalid/customer_service/finesonline/";
    private static final ScraperSettings ON = new ScraperSettings(true, BASE, "test-contact@example.invalid",
            Duration.ZERO, Duration.ofSeconds(1), Duration.ofSeconds(1), Duration.ofSeconds(60), 1024);
    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));

    private static MockEnvironment env(String browser, String scraper, String evidence) {
        MockEnvironment e = new MockEnvironment();
        if (browser != null) e.setProperty("cevoc.scraper.evidence.browser", browser);
        if (scraper != null) e.setProperty("cevoc.scraper.enabled", scraper);
        if (evidence != null) e.setProperty("cevoc.scraper.evidence.enabled", evidence);
        return e;
    }

    @Test
    void liveBrowserIsOffUnlessEverythingIsSwitchedOn() {
        assertThat(ScraperEvidenceFactory.liveRequested(env("playwright", "true", "true"), ON)).isTrue();
        assertThat(ScraperEvidenceFactory.liveRequested(env("Playwright", "true", "true"), ON)).isTrue();
        assertThat(ScraperEvidenceFactory.liveRequested(env(null, "true", "true"), ON)).isFalse();
        assertThat(ScraperEvidenceFactory.liveRequested(env("none", "true", "true"), ON)).isFalse();
        assertThat(ScraperEvidenceFactory.liveRequested(env("playwright", null, "true"), ON)).isFalse();
        assertThat(ScraperEvidenceFactory.liveRequested(env("playwright", "false", "true"), ON)).isFalse();
        assertThat(ScraperEvidenceFactory.liveRequested(env("playwright", "true", "true"), ScraperSettings.off())).isFalse();
    }

    @Test
    void defaultBuildFallsBackToTheFailingFactory() {
        assumeThat(classPresent(ScraperEvidenceFactory.LIVE_FACTORY)).isFalse();
        assertThat(ScraperEvidenceFactory.playwright(ON, "", true)).isNull();
        MockEnvironment e = env("playwright", "true", "true");
        e.setProperty("cevoc.scraper.evidence.base-url", BASE);
        e.setProperty("cevoc.scraper.evidence.contact", "test-contact@example.invalid");
        PenaltyLookupResult r = ScraperEvidenceFactory.create(e, null).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);
    }

    @Test
    void scrapersStayOffByDefault() {
        PenaltyLookupResult r = ScraperEvidenceFactory.create(new MockEnvironment(), null).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
    }

    @Test
    void plateIsVisibleOnlyInsideTheCallAndThenForgotten() {
        RequestScopedRegistration p = new RequestScopedRegistration();
        assertThat(p.registrationFor(REQ)).isEmpty();
        String seen = RequestScopedRegistration.with("TST123", () -> p.registrationFor(REQ).orElse("none"));
        assertThat(seen).isEqualTo("TST123");
        assertThat(p.registrationFor(REQ)).isEmpty();
        try {
            RequestScopedRegistration.with("TST123", () -> {
                throw new IllegalStateException("boom");
            });
        } catch (IllegalStateException expected) {
            // plate must be cleared even when the action fails
        }
        assertThat(p.registrationFor(REQ)).isEmpty();
        assertThat(p.toString()).doesNotContain("TST123");
    }

    @Test
    void blankPlateSuppliesNothing() {
        RequestScopedRegistration p = new RequestScopedRegistration();
        Optional<String> v = RequestScopedRegistration.with("  ", () -> p.registrationFor(REQ));
        assertThat(v).isEmpty();
    }

    @Test
    void redactorKeepsFirstLineAndScrubsSecrets() {
        Redactor r = new Redactor();
        r.add("9000000004");
        r.add("15/01/2026");
        r.add("TST123");
        String msg = "Timeout waiting for locator fill(\"9000000004\") on 15/01/2026 with tst123\nCall log:\n  - 9000000004";
        String out = r.clean(msg);
        assertThat(out).doesNotContain("9000000004").doesNotContain("15/01/2026").doesNotContainIgnoringCase("TST123");
        assertThat(out).doesNotContain("Call log").contains("***");
        r.clear();
        assertThat(r.clean("9000000004")).isEqualTo("9000000004");
        assertThat(new Redactor().clean(null)).isEmpty();
        assertThat(new Redactor().clean("x".repeat(500))).hasSizeLessThan(210);
    }

    private static boolean classPresent(String name) {
        try {
            Class.forName(name);
            return true;
        } catch (ClassNotFoundException | LinkageError e) {
            return false;
        }
    }
}
