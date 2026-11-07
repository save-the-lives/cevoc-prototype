package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.ManifestFirstPenaltyLookupAdapter;
import cevoc.adapter.out.memory.InMemoryMediaAdapter;
import cevoc.adapter.out.revenuensw.RevenueNswHttpLookupAdapter;
import cevoc.adapter.out.scraper.ScraperEvidenceLookupAdapter;
import cevoc.adapter.out.scraper.SearchPageCertificateSource;
import cevoc.adapter.out.stub.StubMediaAdapter;
import cevoc.application.port.out.CertificateSourcePort;
import cevoc.application.port.out.MediaStoragePort;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.livecheck.LiveCheckGuardConfig;
import java.time.LocalDate;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

/**
 * One adapter-selection setting (cevoc.penalty-lookup.adapter) picks the lookup route. Proves: (a) the default with no
 * settings, (b) each value selects the right adapter, (c) the retired names and values are ignored, (d) the application
 * context starts with every old variable absent (the nested default context carries no setting at all).
 */
class PenaltyLookupAdapterSelectionTest {

    private static final PenaltyLookupRequest UNKNOWN = new PenaltyLookupRequest("9555555555", LocalDate.of(2026, 1, 15));

    private static void assertSafeStubDefault(PenaltyLookupPort port, ApplicationContext ctx) {
        assertThat(port).isInstanceOf(ManifestFirstPenaltyLookupAdapter.class);
        // Same answer the public page gave before: an unknown number is "live lookup switched off", nothing is contacted.
        assertThat(port.find(UNKNOWN).status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_DISABLED);
        assertThat(ctx.getBean(MediaStoragePort.class)).isInstanceOf(StubMediaAdapter.class);
        assertThat(ctx.getBeansOfType(LiveCheckGuardConfig.class)).isEmpty();
    }

    /** The default: the real (Chromium) adapter and the browser certificates provider, nothing else switched on. With no contact set
     *  it makes no network call and answers the "switched off" message (the app starts and keeps running). */
    private static void assertBrowserDefault(PenaltyLookupPort port, ApplicationContext ctx) {
        assertThat(port).isInstanceOf(ScraperEvidenceLookupAdapter.class);
        assertThat(port.find(UNKNOWN).status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
        assertThat(ctx.getBean(MediaStoragePort.class)).isInstanceOf(InMemoryMediaAdapter.class);
        assertThat(ctx.getBean(CertificateSourcePort.class)).isInstanceOf(cevoc.adapter.out.scraper.CertificateProviderChain.class);
        assertThat(ctx.getBeansOfType(LiveCheckGuardConfig.class)).isEmpty();
        assertThat(ctx.getBeansOfType(cevoc.adapter.out.demo.DemoRoute.class)).isEmpty();
    }

    @Nested
    @SpringBootTest
    class NoSettingsAtAll {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void startsAndDefaultsToTheBrowserAdapterAndProvider() {
            assertBrowserDefault(port, ctx);
        }
    }

    @Nested
    @SpringBootTest(properties = {"cevoc.penalty-lookup.adapter=stub", "cevoc.certificates.providers=none"})
    class StubValue {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void selectsStubExplicitly() {
            assertSafeStubDefault(port, ctx);
            assertThat(ctx.getBeansOfType(CertificateSourcePort.class)).isEmpty();
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter=")
    class EmptyValueMeansDefault {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void emptyIsTheDefault() {
            assertBrowserDefault(port, ctx);
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter= Browser ")
    class BrowserValue {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void selectsTheChromiumRouteWhichStaysOffWithoutUrlAndContact() {
            assertThat(port).isInstanceOf(ScraperEvidenceLookupAdapter.class);
            assertThat(ctx.getBean(MediaStoragePort.class)).isInstanceOf(InMemoryMediaAdapter.class);
            assertThat(port.find(UNKNOWN).status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter=http")
    class HttpValue {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void selectsThePlainRequestRouteWhichStaysOffWhenNotConfigured() {
            assertThat(port).isInstanceOf(RevenueNswHttpLookupAdapter.class);
            assertThat(ctx.getBean(MediaStoragePort.class)).isInstanceOf(InMemoryMediaAdapter.class);
            assertThat(port.find(UNKNOWN).status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
        }
    }

    /** The new cevoc.evidence.providers list takes precedence over the legacy single-value setting. */
    @Nested
    @SpringBootTest(properties = {"cevoc.evidence.providers=browser", "cevoc.penalty-lookup.adapter=stub"})
    class EvidenceProvidersOverridesLegacy {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void newPropertyTakesPrecedence() {
            // The new property says browser, the legacy says stub; browser wins.
            assertBrowserDefault(port, ctx);
        }
    }

    /** cevoc.evidence.providers=http,browser activates the adaptive (circuit-breaker) adapter. */
    @Nested
    @SpringBootTest(properties = "cevoc.evidence.providers=http,browser")
    class EvidenceProvidersHttpBrowser {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void selectsTheAdaptiveAdapter() {
            assertThat(port).isInstanceOf(cevoc.adapter.out.revenuensw.AdaptivePenaltyLookupAdapter.class);
            assertThat(ctx.getBean(MediaStoragePort.class)).isInstanceOf(InMemoryMediaAdapter.class);
        }
    }

    /** cevoc.evidence.providers=http selects just the HTTP adapter. */
    @Nested
    @SpringBootTest(properties = "cevoc.evidence.providers=http")
    class EvidenceProvidersHttpOnly {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void selectsSingleHttpAdapter() {
            assertThat(port).isInstanceOf(RevenueNswHttpLookupAdapter.class);
            assertThat(ctx.getBean(MediaStoragePort.class)).isInstanceOf(InMemoryMediaAdapter.class);
        }
    }

    /** cevoc.evidence.providers=stub selects stub. */
    @Nested
    @SpringBootTest(properties = {"cevoc.evidence.providers=stub", "cevoc.certificates.providers=none"})
    class EvidenceProvidersStub {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void selectsStub() {
            assertSafeStubDefault(port, ctx);
        }
    }

    /** When cevoc.evidence.providers is empty, the legacy setting is used (backward compatibility). */
    @Nested
    @SpringBootTest(properties = {"cevoc.evidence.providers=", "cevoc.penalty-lookup.adapter=http"})
    class EvidenceProvidersEmptyFallsBackToLegacy {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void fallsBackToLegacySetting() {
            assertThat(port).isInstanceOf(RevenueNswHttpLookupAdapter.class);
        }
    }

    /** The retired switches and values are read by nothing: no fallback, no alias. */
    @Nested
    @SpringBootTest(properties = {
            "cevoc.scraper.enabled=true", "cevoc.scraper.evidence.enabled=true", "cevoc.scraper.evidence.browser=playwright",
            "cevoc.scraper.evidence.base-url=https://site.example.invalid/",
            "cevoc.scraper.certificates.enabled=true", "cevoc.scraper.certificates.approval-reference=x",
            "cevoc.revenue-nsw-http.enabled=true", "cevoc.live-check.token=abc",
            "CEVOC_SCRAPER_ENABLED=true", "CEVOC_SCRAPER_EVIDENCE_ENABLED=true", "CEVOC_SCRAPER_EVIDENCE_BROWSER=playwright",
            "CEVOC_SCRAPER_CERTIFICATES_ENABLED=true", "CEVOC_REVENUE_NSW_HTTP_ENABLED=true", "CEVOC_LIVECHECK_TOKEN=abc"})
    class OldSwitchesIgnored {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void stillTheDefault() {
            assertBrowserDefault(port, ctx);
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter=scraper-evidence")
    class OldValueScraperEvidenceIsNoAlias {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void fallsBackToStub() {
            assertSafeStubDefault(port, ctx);
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter=revenue-nsw-http")
    class OldValueRevenueNswHttpIsNoAlias {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void fallsBackToStub() {
            assertSafeStubDefault(port, ctx);
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter=manifest")
    class OldValueManifestIsNoAlias {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void fallsBackToStub() {
            assertSafeStubDefault(port, ctx);
        }
    }
}
