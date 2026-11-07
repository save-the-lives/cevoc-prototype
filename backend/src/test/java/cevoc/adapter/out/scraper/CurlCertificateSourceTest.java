package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cevoc.domain.CertificateQuery;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The curl provider with a fake process runner and FICTITIOUS pages: no process, no network. */
class CurlCertificateSourceTest {

    private static final String URL = "https://search.example.invalid/test/searchCertificates.jsf";
    private static final CertificateQuery Q = CertificateQuery.aroundOffence("TEST-LOC-01", LocalDate.of(2026, 10, 30), LocalTime.NOON, null);

    @AfterEach
    void cleanUp() {
        LookupDiagnostic.clear();
    }

    /** Plays curl: writes the page named by --output, answers the status on stdout, records the command and the POST body. */
    static class FakeCurl implements CurlPageFetcher.Runner {
        final List<List<String>> commands = new ArrayList<>();
        final List<String> postBodies = new ArrayList<>();
        final List<Path> dirs = new ArrayList<>();
        int exit = 0;
        String status = "200";
        String stderr = "";
        String form = CertificatePageParserTest.fixture("search-page-form.html");
        String result = CertificatePageParserTest.fixture("results-certificates.html");

        @Override
        public CurlPageFetcher.Result run(List<String> c, Duration limit) throws IOException {
            commands.add(c);
            Path out = Path.of(c.get(c.indexOf("--output") + 1));
            dirs.add(out.getParent());
            int d = c.indexOf("--data-binary");
            if (d >= 0) {
                postBodies.add(Files.readString(Path.of(c.get(d + 1).substring(1)), StandardCharsets.UTF_8));
            }
            if (exit == 0) {
                Files.writeString(out, d >= 0 ? result : form, StandardCharsets.UTF_8);
            }
            return new CurlPageFetcher.Result(exit, status, stderr);
        }
    }

    private static CurlCertificateSource source(FakeCurl fake) {
        return new CurlCertificateSource("curl", Duration.ofSeconds(10), URL, 0L,
                Duration.ofMinutes(5), Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC), fake);
    }

    @Test
    void getsTheFormThenPostsItWithTheSameCookieJarAndParsesTheResults() {
        FakeCurl fake = new FakeCurl();
        assertThat(source(fake).findCertificates(Q)).hasSize(5);
        assertThat(fake.commands).hasSize(2);
        List<String> get = fake.commands.get(0);
        List<String> post = fake.commands.get(1);
        assertThat(get).doesNotContain("--data-binary");
        assertThat(post).contains("--data-binary");
        // One jar for both requests, read and written.
        String jar = get.get(get.indexOf("--cookie") + 1);
        assertThat(get.get(get.indexOf("--cookie-jar") + 1)).isEqualTo(jar);
        assertThat(post.get(post.indexOf("--cookie") + 1)).isEqualTo(jar);
        assertThat(post.get(post.indexOf("--cookie-jar") + 1)).isEqualTo(jar);
        // The form fields went by file: view state and search terms are in the body, not in the arguments.
        String body = fake.postBodies.get(0);
        assertThat(body).contains("javax.faces.ViewState=TEST-VIEW-STATE").contains("TEST-LOC-01").contains("30%2F10%2F2026+00%3A00");
        assertThat(String.join(" ", post)).doesNotContain("TEST-VIEW-STATE").doesNotContain("TEST-LOC-01");
        assertThat(LookupDiagnostic.take()).contains("cert-provider=curl").doesNotContain("TEST-VIEW-STATE");
    }

    @Test
    void tempFilesAreDeletedAfterASuccessAndAfterAFailure() {
        FakeCurl ok = new FakeCurl();
        source(ok).findCertificates(Q);
        assertThat(ok.dirs).allMatch(d -> !Files.exists(d));
        FakeCurl bad = new FakeCurl();
        bad.exit = 28;
        bad.stderr = "curl: (28) Operation timed out";
        assertThatThrownBy(() -> source(bad).findCertificates(Q)).isInstanceOf(ScrapeException.class).hasMessage("curl-exit-28");
        assertThat(bad.dirs).hasSize(1).allMatch(d -> !Files.exists(d));
    }

    @Test
    void aNonZeroExitFailsTheLookupWithoutAPost() {
        FakeCurl fake = new FakeCurl();
        fake.exit = 35;
        assertThatThrownBy(() -> source(fake).findCertificates(Q)).hasMessage("curl-exit-35");
        assertThat(fake.commands).hasSize(1);
    }

    @Test
    void refusalsKeepTheirStatusAndOtherNon2xxIsAnOrdinaryFailure() {
        for (String s : new String[] {"401", "403", "429"}) {
            FakeCurl fake = new FakeCurl();
            fake.status = s;
            assertThatThrownBy(() -> source(fake).findCertificates(Q)).hasMessageContaining("blocked-" + s);
        }
        FakeCurl fake = new FakeCurl();
        fake.status = "500";
        assertThatThrownBy(() -> source(fake).findCertificates(Q)).hasMessageContaining("HTTP 500");
        fake.status = "";
        assertThatThrownBy(() -> source(fake).findCertificates(Q)).hasMessageContaining("HTTP 0");
    }

    @Test
    void aRefusalOfTheCurlLegFallsThroughToTheNextProviderInTheChain() {
        FakeCurl fake = new FakeCurl();
        fake.status = "403";
        List<String> calls = new ArrayList<>();
        var chain = new CertificateProviderChain(List.of("curl", "next"), List.of(new HttpLegFallbackSource(source(fake)), q -> {
            calls.add("next");
            return List.of();
        }));
        assertThat(chain.findCertificates(Q)).isEmpty();
        assertThat(calls).containsExactly("next");
    }

    @Test
    void resultsAreCachedBrieflyLikeTheOtherProviders() {
        FakeCurl fake = new FakeCurl();
        CurlCertificateSource s = source(fake);
        s.findCertificates(Q);
        s.findCertificates(Q);
        assertThat(fake.commands).hasSize(2);
    }

    // ---- command construction ----

    @Test
    void theGetCommandIsExactlyTheOwnerProvenOneWithPlaceholders() {
        Path jar = Path.of("/tmp/JAR");
        Path body = Path.of("/tmp/BODY");
        List<String> c = CurlPageFetcher.command("curl", Duration.ofSeconds(10), "https://HOST/PATH", jar, body,
                CurlPageFetcher.BrowserHeadersForCurl.forGet(), null);
        assertThat(c).containsExactly("curl", "--silent", "--show-error", "--compressed", "--location", "--max-redirs", "5",
                "--proto", "=https", "--proto-redir", "=https", "--connect-timeout", "10", "--max-time", "10",
                "--cookie", "/tmp/JAR", "--cookie-jar", "/tmp/JAR",
                "-H", "User-Agent: " + BrowserHeaders.USER_AGENT,
                "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "-H", "Accept-Language: en-AU,en;q=0.9",
                "-H", "Accept-Encoding: gzip, deflate, br",
                "-H", "Sec-Fetch-Mode: navigate",
                "-H", "Sec-Fetch-Dest: document",
                "-H", "Connection: keep-alive",
                "-H", "Sec-Fetch-Site: none",
                "--output", "/tmp/BODY", "--write-out", "%{http_code}", "https://HOST/PATH");
    }

    @Test
    void thePostCommandAddsTheBodyFileFormHeadersOriginAndReferer() {
        List<String> c = CurlPageFetcher.command("curl", Duration.ofSeconds(10), "https://HOST/ACTION", Path.of("/tmp/JAR"), Path.of("/tmp/BODY"),
                CurlPageFetcher.BrowserHeadersForCurl.forPost("https://HOST/PAGE", "https://HOST/ACTION"), Path.of("/tmp/POST"));
        assertThat(c).contains("Content-Type: application/x-www-form-urlencoded", "Origin: https://HOST", "Referer: https://HOST/PAGE",
                "Sec-Fetch-Site: same-origin", "--data-binary", "@/tmp/POST");
        assertThat(c.get(c.size() - 1)).isEqualTo("https://HOST/ACTION");
    }

    @Test
    void stderrIsOneLineWithoutSessionIdsAndCapped() {
        assertThat(CurlPageFetcher.clean("curl: (6) bad\n  host;jsessionid=ABC123 x")).isEqualTo("curl: (6) bad host;jsessionid=- x");
        assertThat(CurlPageFetcher.clean("x".repeat(1000))).hasSize(300);
        assertThat(CurlPageFetcher.clean(null)).isEmpty();
    }

    @Test
    void theRealRunnerReportsAMissingProgramAsAFailureNotACrash() {
        CurlPageFetcher f = new CurlPageFetcher("/nonexistent/curl-x", Duration.ofSeconds(1), CurlPageFetcher.processRunner());
        try {
            assertThatThrownBy(() -> f.get(URL)).isInstanceOf(ScrapeException.class).hasMessage("curl-unavailable");
        } finally {
            f.close();
        }
        assertThat(f.directory()).doesNotExist();
    }

    // ---- wiring ----

    @Test
    void wiringCurlFirstInTheChainWrapsItSoARefusalFallsThrough() {
        assertThat(CertificateProviders.create(new MockEnvironment().withProperty("cevoc.certificates.providers", "curl")))
                .isInstanceOf(CurlCertificateSource.class);
        assertThat(CertificateProviders.create(new MockEnvironment().withProperty("cevoc.certificates.providers", "curl,browser")))
                .isInstanceOf(CertificateProviderChain.class);
        assertThat(CertificateProviders.ids(new MockEnvironment())).startsWith("curl");
    }
}
