package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cevoc.domain.CertificateQuery;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The plain-HTTP search provider with a fake fetcher and FICTITIOUS pages: no network. */
class SearchPageHttpCertificateSourceTest {

    static final String URL = "https://search.example.invalid/searchCertificates.jsf";
    private static final CertificateQuery Q = CertificateQuery.aroundOffence("TEST-LOC-01", LocalDate.of(2026, 10, 30), LocalTime.NOON, null);

    /** GET serves a form page, POST serves the result; both recorded. */
    static class FormFetcher implements PageFetcher {
        final String formHtml;
        final String result;
        String failure;
        final List<String> calls = new ArrayList<>();
        final List<Map<String, String>> posts = new ArrayList<>();
        final List<String> postUrls = new ArrayList<>();

        FormFetcher(String result) {
            this(CertificatePageParserTest.fixture("search-page-form.html"), result);
        }

        FormFetcher(String formHtml, String result) {
            this.formHtml = formHtml;
            this.result = result;
        }

        @Override
        public String get(String url) {
            calls.add("GET");
            if (failure != null) throw new ScrapeException(failure);
            return formHtml;
        }

        @Override
        public String postForm(String url, Map<String, String> fields) {
            calls.add("POST");
            postUrls.add(url);
            posts.add(fields);
            return result;
        }
    }

    static SearchPageHttpCertificateSource source(PageFetcher f) {
        return new SearchPageHttpCertificateSource(() -> f, URL, new CertificatePageParser(),
                new EvidenceRateLimiter(Duration.ZERO, () -> 0L, n -> { }), Duration.ofMinutes(5),
                Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC));
    }

    @AfterEach
    void cleanUp() {
        LookupDiagnostic.clear();
    }

    @Test
    void postsOnlyTheNamesFoundOnThePageWithTheHiddenFieldsAndTheWholeDay() {
        FormFetcher f = new FormFetcher(CertificatePageParserTest.fixture("results-certificates.html"));
        assertThat(source(f).findCertificates(Q)).hasSize(5);
        assertThat(f.calls).containsExactly("GET", "POST");
        assertThat(f.postUrls).containsExactly("https://search.example.invalid/test/searchCertificates.jsf");
        Map<String, String> body = f.posts.get(0);
        assertThat(body).containsEntry("j_idt10:loc", "TEST-LOC-01")
                .containsEntry("j_idt10:dfrom_input", "30/10/2026 00:00")
                .containsEntry("j_idt10:dto_input", "30/10/2026 23:59")
                .containsEntry("j_idt10", "j_idt10").containsEntry("javax.faces.ViewState", "TEST-VIEW-STATE")
                .containsKey("j_idt10:go").doesNotContainKeys("j_idt10:clr", "j_idt10:cls");
        assertThat(body).hasSize(6);
        String diag = LookupDiagnostic.take();
        assertThat(diag).contains("srch-http-found: loc=label; from=label; to=label").contains("cert-provider=search-page-http");
        assertThat(diag).doesNotContain("TEST-LOC-01").doesNotContain("TEST-VIEW-STATE");
    }

    @Test
    void aFreshFetcherIsUsedForEachLookupAndResultsAreCachedBriefly() {
        List<FormFetcher> made = new ArrayList<>();
        var s = new SearchPageHttpCertificateSource(() -> {
            FormFetcher f = new FormFetcher(CertificatePageParserTest.fixture("results-certificates.html"));
            made.add(f);
            return f;
        }, URL, new CertificatePageParser(), new EvidenceRateLimiter(Duration.ZERO, () -> 0L, n -> { }), Duration.ofMinutes(5),
                Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC));
        s.findCertificates(Q);
        s.findCertificates(Q);
        s.findCertificates(CertificateQuery.aroundOffence("TEST-LOC-01", LocalDate.of(2026, 10, 31), LocalTime.NOON, null));
        assertThat(made).hasSize(2);
    }

    @Test
    void aRefusalOrCaptchaStopsWithItsOwnCauseAndPostsNothing() {
        for (String status : new String[] {"blocked-401", "blocked-403", "blocked-429"}) {
            FormFetcher f = new FormFetcher("x");
            f.failure = status;
            assertThatThrownBy(() -> source(f).findCertificates(Q)).hasMessageContaining(status);
            assertThat(f.calls).containsExactly("GET");
            assertThat(LookupDiagnostic.take()).contains("cause=" + status);
        }
        FormFetcher captcha = new FormFetcher("<html><body><form><div class=\"g-recaptcha\"></div></form></body></html>", "x");
        assertThatThrownBy(() -> source(captcha).findCertificates(Q)).hasMessageContaining("captcha");
        assertThat(captcha.calls).containsExactly("GET");
    }

    @Test
    void aPageWithoutTheSearchFormIsNotRecognisedAndNothingIsPosted() {
        FormFetcher f = new FormFetcher("<html><body><form><input type=\"text\" name=\"a\"/></form></body></html>", "x");
        assertThatThrownBy(() -> source(f).findCertificates(Q)).hasMessageContaining("no-search-form");
        assertThat(f.calls).containsExactly("GET");
    }

    @Test
    void neverPostsToAnotherHost() {
        String elsewhere = CertificatePageParserTest.fixture("search-page-form.html")
                .replace("action=\"/test/searchCertificates.jsf\"", "action=\"https://other.example.invalid/x\"");
        FormFetcher f = new FormFetcher(elsewhere, "x");
        assertThatThrownBy(() -> source(f).findCertificates(Q)).hasMessageContaining("no-search-form");
        assertThat(f.calls).containsExactly("GET");
    }

    @Test
    void theChainTriesTheHttpRouteFirstThenTheBrowserAndNotesWhoFailed() {
        FormFetcher bad = new FormFetcher("<html><body>nothing</body></html>", "x");
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        var chain = new CertificateProviderChain(List.of("search-page-http", "search-page"), List.of(source(bad),
                new SearchPageCertificateSource(new ScraperEvidenceTest.Sessions(fake), URL, new CertificatePageParser(),
                        Duration.ofMinutes(5), Clock.systemUTC())));
        assertThat(chain.findCertificates(Q)).hasSize(5);
        assertThat(LookupDiagnostic.take()).contains("cert-provider-failed=search-page-http").contains("cert-provider=search-page");
    }

    @Test
    void aRefusalOnTheHttpRouteDoesNotFallBackToTheBrowser() {
        FormFetcher f = new FormFetcher("x");
        f.failure = "blocked-403";
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        var chain = new CertificateProviderChain(List.of("search-page-http", "search-page"), List.of(source(f),
                new SearchPageCertificateSource(new ScraperEvidenceTest.Sessions(fake), URL, new CertificatePageParser(),
                        Duration.ofMinutes(5), Clock.systemUTC())));
        assertThatThrownBy(() -> chain.findCertificates(Q)).hasMessageContaining("blocked-403");
        assertThat(fake.searches).isEmpty();
    }

    @Test
    void configNeedsOnlyTheContactAndBuildsTheHttpProvider() {
        var env = new org.springframework.mock.env.MockEnvironment().withProperty("cevoc.certificates.providers", "http,browser");
        // No contact: the http provider is skipped (logged, no crash); the browser provider remains.
        assertThat(CertificateProviders.create(env)).isInstanceOf(SearchPageCertificateSource.class);
        env.setProperty("cevoc.scraper.evidence.contact", "test-contact@example.invalid");
        assertThat(CertificateProviders.create(env)).isInstanceOf(CertificateProviderChain.class);
        env.setProperty("cevoc.certificates.providers", "http");
        assertThat(CertificateProviders.create(env)).isInstanceOf(SearchPageHttpCertificateSource.class);
    }
}
