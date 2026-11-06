package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** HTTP-first certificates path with fake legs and FICTITIOUS cookie values: no network, no browser. */
class HttpFirstCertificateSourceTest {

    private static final Instant T0 = Instant.parse("2030-01-01T00:00:00Z");
    private static final CertificateQuery Q = CertificateQuery.aroundOffence("TEST-LOC-01", LocalDate.of(2026, 10, 30), LocalTime.NOON, null);
    private static final List<SessionCookies.Cookie> COOKIES = List.of(
            new SessionCookies.Cookie("JSESSIONID", "fictitious-session", "h.example.invalid", "/"),
            new SessionCookies.Cookie("ak_bmsc", "fictitious-a", "h.example.invalid", "/"),
            new SessionCookies.Cookie("other", "fictitious-b", "h.example.invalid", "/"));

    @AfterEach
    void cleanUp() {
        LookupDiagnostic.clear();
    }

    @Test
    void keepsOnlyAllowListedCookiesAndOnlyWithASession() {
        SessionCookies store = new SessionCookies();
        store.put(COOKIES, T0);
        assertThat(store.fresh(T0).orElseThrow()).extracting(SessionCookies.Cookie::name).containsExactly("JSESSIONID", "ak_bmsc");
        store.put(List.of(new SessionCookies.Cookie("ak_bmsc", "x", "d", "/")), T0);
        assertThat(store.fresh(T0)).isEmpty();
        store.put(COOKIES, T0);
        assertThat(store.fresh(T0.plus(SessionCookies.TTL).plusSeconds(1))).isEmpty();
    }

    @Test
    void withoutCookiesTheBrowserIsUsedAndWithCookiesHttpAnswersFirst() {
        SessionCookies store = new SessionCookies();
        AtomicInteger httpCalls = new AtomicInteger();
        AtomicInteger browserCalls = new AtomicInteger();
        CertificateSourcePort browser = q -> {
            browserCalls.incrementAndGet();
            store.put(COOKIES, T0);
            return List.<CertificateRef>of();
        };
        HttpFirstCertificateSource s = new HttpFirstCertificateSource(store, Clock.fixed(T0, ZoneOffset.UTC),
                c -> q -> {
                    httpCalls.incrementAndGet();
                    return List.<CertificateRef>of();
                }, browser);
        s.findCertificates(Q);
        assertThat(browserCalls.get()).isEqualTo(1);
        assertThat(httpCalls.get()).isZero();
        s.findCertificates(Q);
        assertThat(browserCalls.get()).isEqualTo(1);
        assertThat(httpCalls.get()).isEqualTo(1);
        assertThat(LookupDiagnostic.take()).contains("cert-http-first=no-session").contains("cert-http-first=hit");
    }

    @Test
    void aRefusedHttpCallDropsTheCookiesAndFallsBackToTheBrowser() {
        SessionCookies store = new SessionCookies();
        store.put(COOKIES, T0);
        AtomicInteger browserCalls = new AtomicInteger();
        HttpFirstCertificateSource s = new HttpFirstCertificateSource(store, Clock.fixed(T0, ZoneOffset.UTC),
                c -> q -> {
                    throw new ScrapeException("blocked-403");
                }, q -> {
                    browserCalls.incrementAndGet();
                    return List.<CertificateRef>of();
                });
        s.findCertificates(Q);
        assertThat(browserCalls.get()).isEqualTo(1);
        assertThat(store.fresh(T0)).isEmpty();
        String notes = LookupDiagnostic.take();
        assertThat(notes).contains("cert-http-first=fallback; cause=blocked-403").doesNotContain("fictitious");
    }

    @Test
    void theBrowserSourceHandsItsSessionCookiesToTheStoreAndClosesNothingElse() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession() {
            @Override
            public List<SessionCookies.Cookie> sessionCookies() {
                return COOKIES;
            }
        };
        SessionCookies store = new SessionCookies();
        new SearchPageCertificateSource(new ScraperEvidenceTest.Sessions(fake), "https://search.example.invalid/s.jsf",
                new CertificatePageParser(), Duration.ofMinutes(5), Clock.fixed(T0, ZoneOffset.UTC), store).findCertificates(Q);
        assertThat(store.fresh(T0)).isPresent();
    }
}
