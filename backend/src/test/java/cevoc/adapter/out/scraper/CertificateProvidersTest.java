package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The provider list in config (the cutover seam) and the ordered chain behind it. No network, no browser. */
class CertificateProvidersTest {

    private static final CertificateQuery Q = CertificateQuery.ofLocation("TEST-LOC-01",
            LocalDateTime.of(2026, 10, 30, 0, 0), LocalDateTime.of(2026, 10, 30, 23, 59));

    @org.junit.jupiter.api.AfterEach
    void cleanUp() {
        LookupDiagnostic.clear();
    }

    private static MockEnvironment env(String providers, String ignored) {
        MockEnvironment e = new MockEnvironment();
        if (providers != null) e.setProperty("cevoc.certificates.providers", providers);
        return e;
    }

    @Test
    void nothingConfiguredMeansHttpThenTheBrowserProvider() {
        assertThat(CertificateProviders.ids(new MockEnvironment())).containsExactly("http", "browser");
        assertThat(CertificateProviders.ids(env("", null))).containsExactly("http", "browser");
        assertThat(CertificateProviders.ids(env("   ", null))).containsExactly("http", "browser");
        // No contact: the http leg is skipped, leaving the browser provider alone.
        assertThat(CertificateProviders.create(new MockEnvironment())).isInstanceOf(SearchPageCertificateSource.class);
        assertThat(CertificateProviders.create(env("  ", null))).isInstanceOf(SearchPageCertificateSource.class);
    }

    @Test
    void withAContactTheDefaultIsAChainWithHttpFirst() {
        MockEnvironment withContact = env(null, null).withProperty("cevoc.scraper.evidence.contact", "test-contact@example.invalid");
        assertThat(CertificateProviders.create(withContact)).isInstanceOf(CertificateProviderChain.class);
    }

    @Test
    void noneIsTheExplicitChoiceOfNoCertificateSource() {
        assertThat(CertificateProviders.ids(env(" None ", null))).isEmpty();
        assertThat(CertificateProviders.create(env("none", null))).isNull();
    }

    @Test
    void theHttpProviderWithoutAContactDoesNotCrashAndHasNoSource() {
        assertThat(CertificateProviders.create(env("http", null))).isNull();
        MockEnvironment withContact = env("http", null).withProperty("cevoc.scraper.evidence.contact", "test-contact@example.invalid");
        assertThat(CertificateProviders.create(withContact)).isInstanceOf(SearchPageHttpCertificateSource.class);
    }

    @Test
    void theListIsOrderedTrimmedLowerCasedAndDeduplicated() {
        assertThat(CertificateProviders.ids(env(" HTTP , browser,browser ", null))).containsExactly("http", "browser");
    }

    @Test
    void retiredNamesAndTheLegacySwitchAreIgnoredAndNeverStopStartUp() {
        // old provider names are not aliases
        assertThat(CertificateProviders.ids(env("search-page,search-page-http,tfnsw-api", null))).isEmpty();
        assertThat(CertificateProviders.create(env("search-page,search-page-http", null))).isNull();
        // the old flag no longer selects the http-form provider
        MockEnvironment e = new MockEnvironment().withProperty("cevoc.certificates.providers", "search-page")
                .withProperty("cevoc.scraper.certificates.enabled", "true");
        assertThat(CertificateProviders.ids(e)).isEmpty();
        assertThat(CertificateProviders.create(e)).isNull();
    }

    @Test
    void httpFormIsOnlyUsedWhenListedAndNeedsNoApprovalReference() {
        assertThat(CertificateProviders.create(env("http-form", null))).isInstanceOf(CertificateScraperAdapter.class);
    }

    @Test
    void browserProviderStartsWithoutAnApprovalReferenceAndWithoutABrowserItRefusesToOpenOne() {
        for (String ref : new String[] {null, "  ", "TEST-REF-1"}) {
            CertificateSourcePort p = CertificateProviders.create(env("browser", ref));
            assertThat(p).isInstanceOf(SearchPageCertificateSource.class);
            // No Chromium build / no URL and contact: no session can open, so no network call is possible.
            assertThatThrownBy(() -> p.findCertificates(Q)).isInstanceOf(ScrapeException.class);
        }
    }

    @Test
    void theApiProviderIsReservedAndUnknownIdsAreIgnored() {
        assertThatThrownBy(() -> CertificateProviders.create(env("api,browser", null)))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("not available yet");
        assertThat(CertificateProviders.create(env("nonsense", null))).isNull();
    }

    @Test
    void severalProvidersFormAChainAndTheBrowserLinkNeedsNoExtraSetting() {
        assertThat(CertificateProviders.create(env("browser-link", null))).isInstanceOf(BrowserCertificateSourceAdapter.class);
        assertThat(CertificateProviders.create(env("browser,browser-link", null))).isInstanceOf(CertificateProviderChain.class);
    }

    @Test
    void theCertificationLinkIsFollowedOnlyWhenBrowserLinkIsListed() {
        assertThat(CertificateProviders.ids(env("browser", "x"))).doesNotContain(CertificateProviders.BROWSER_LINK);
        assertThat(CertificateProviders.ids(env("browser-link", null))).contains(CertificateProviders.BROWSER_LINK);
    }

    // ---- the chain ----

    private static CertificateSourcePort answering(List<CertificateRef> rows, List<String> calls, String id) {
        return q -> {
            calls.add(id);
            return rows;
        };
    }

    private static CertificateSourcePort failing(String message, List<String> calls, String id) {
        return q -> {
            calls.add(id);
            throw new ScrapeException(message);
        };
    }

    private static final CertificateRef ROW = new CertificateRef("TEST", "Camera", "p", null, null, null, null, null);

    @Test
    void theFirstProviderThatAnswersEndsTheChainEvenWithAnEmptyList() {
        List<String> calls = new ArrayList<>();
        var chain = new CertificateProviderChain(List.of(answering(List.of(), calls, "api"), answering(List.of(ROW), calls, "page")));
        assertThat(chain.findCertificates(Q)).isEmpty();
        assertThat(calls).containsExactly("api");
    }

    @Test
    void aFailingProviderHandsOverToTheNextAndTheLastFailureIsRethrown() {
        List<String> calls = new ArrayList<>();
        assertThat(new CertificateProviderChain(List.of(failing("api down", calls, "api"), answering(List.of(ROW), calls, "page")))
                .findCertificates(Q)).hasSize(1);
        assertThat(calls).containsExactly("api", "page");
        List<String> calls2 = new ArrayList<>();
        var all = new CertificateProviderChain(List.of(failing("one", calls2, "a"), failing("two", calls2, "b")));
        assertThatThrownBy(() -> all.findCertificates(Q)).hasMessage("two");
    }

    @Test
    void aRefusalStopsTheWholeChainAtOnce() {
        for (String status : new String[] {"blocked-401", "blocked-403", "blocked-429"}) {
            List<String> calls = new ArrayList<>();
            var chain = new CertificateProviderChain(List.of(failing("browser step 'certificates' failed: " + status, calls, "page"),
                    answering(List.of(ROW), calls, "next")));
            assertThatThrownBy(() -> chain.findCertificates(Q)).hasMessageContaining(status);
            assertThat(calls).containsExactly("page");
        }
    }

    @Test
    void anEmptyChainIsRejected() {
        assertThatThrownBy(() -> new CertificateProviderChain(List.of())).isInstanceOf(IllegalArgumentException.class);
    }
}
