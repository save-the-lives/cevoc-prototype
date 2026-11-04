package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
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

    private static MockEnvironment env(String providers, String approval) {
        MockEnvironment e = new MockEnvironment();
        if (providers != null) e.setProperty("cevoc.certificates.providers", providers);
        if (approval != null) e.setProperty("cevoc.certificates.approval-reference", approval);
        return e;
    }

    @Test
    void nothingConfiguredMeansNoCertificateSource() {
        assertThat(CertificateProviders.ids(new MockEnvironment())).isEmpty();
        assertThat(CertificateProviders.create(new MockEnvironment())).isNull();
        assertThat(CertificateProviders.create(env("  ", null))).isNull();
    }

    @Test
    void theListIsOrderedTrimmedLowerCasedAndDeduplicated() {
        assertThat(CertificateProviders.ids(env(" TFNSW-API , search-page,search-page ", null))).containsExactly("tfnsw-api", "search-page");
    }

    @Test
    void theLegacySwitchStillSelectsTheHttpFormScraperWhenNoListIsGiven() {
        MockEnvironment e = new MockEnvironment().withProperty("cevoc.scraper.certificates.enabled", "true");
        assertThat(CertificateProviders.ids(e)).containsExactly("http-form");
        assertThatThrownBy(() -> CertificateProviders.create(e)).isInstanceOf(IllegalStateException.class).hasMessageContaining("approval-reference");
        e.setProperty("cevoc.scraper.certificates.approval-reference", "TEST-REF-1");
        assertThat(CertificateProviders.create(e)).isInstanceOf(CertificateScraperAdapter.class);
    }

    @Test
    void searchPageNeedsTheApprovalReferenceAndWithoutABrowserItRefusesToOpenOne() {
        assertThatThrownBy(() -> CertificateProviders.create(env("search-page", null))).isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("approval-reference");
        assertThatThrownBy(() -> CertificateProviders.create(env("search-page", "  "))).isInstanceOf(IllegalStateException.class);
        CertificateSourcePort p = CertificateProviders.create(env("search-page", "TEST-REF-1"));
        assertThat(p).isInstanceOf(SearchPageCertificateSource.class);
        // Browser not switched on (no playwright, no scraper flags): no session can open, so no network call is possible.
        assertThatThrownBy(() -> p.findCertificates(Q)).isInstanceOf(ScrapeException.class);
    }

    @Test
    void theApiProviderIsReservedAndUnknownIdsFailAtStartUp() {
        assertThatThrownBy(() -> CertificateProviders.create(env("tfnsw-api,search-page", "TEST-REF-1")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("not available yet");
        assertThatThrownBy(() -> CertificateProviders.create(env("nonsense", "TEST-REF-1")))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("unknown certificate provider");
    }

    @Test
    void severalProvidersFormAChainAndTheBrowserLinkNeedsNoExtraApproval() {
        assertThat(CertificateProviders.create(env("browser-link", null))).isInstanceOf(BrowserCertificateSourceAdapter.class);
        assertThat(CertificateProviders.create(env("search-page,browser-link", "TEST-REF-1"))).isInstanceOf(CertificateProviderChain.class);
    }

    @Test
    void theCertificationLinkIsFollowedOnlyWhenBrowserLinkIsListed() {
        assertThat(CertificateProviders.ids(env("search-page", "x"))).doesNotContain(CertificateProviders.BROWSER_LINK);
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
