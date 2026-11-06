package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.time.Clock;
import java.util.List;
import java.util.function.Function;

/**
 * Certificates {@code browser} provider with an HTTP-first optimisation (owner direction 2026-11-07): when a browser visit left
 * session cookies ({@link SessionCookies}), try the plain HTTP search with them first, which costs no Chromium. Any failure there
 * (403, expired session, no form, parse failure) drops the cookies and falls back to the browser source, whose successful visit
 * refreshes them. The browser leg keeps every safeguard; its own refusal still ends the attempt.
 */
public class HttpFirstCertificateSource implements CertificateSourcePort {

    private final SessionCookies store;
    private final Clock clock;
    private final Function<List<SessionCookies.Cookie>, CertificateSourcePort> http;
    private final CertificateSourcePort browser;

    public HttpFirstCertificateSource(SessionCookies store, Clock clock,
                                      Function<List<SessionCookies.Cookie>, CertificateSourcePort> http, CertificateSourcePort browser) {
        this.store = store;
        this.clock = clock;
        this.http = http;
        this.browser = browser;
    }

    @Override
    public List<CertificateRef> findCertificates(CertificateQuery query) {
        var cookies = store.fresh(clock.instant());
        if (cookies.isPresent()) {
            try {
                List<CertificateRef> rows = http.apply(cookies.get()).findCertificates(query);
                LookupDiagnostic.note("cert-http-first=hit");
                return rows;
            } catch (ScrapeException | IllegalStateException e) {
                store.clear();
                String m = e.getMessage() == null ? "failed" : e.getMessage().toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9-]+", "-");
                LookupDiagnostic.note("cert-http-first=fallback; cause=" + m.substring(0, Math.min(m.length(), 40)));
            }
        } else {
            LookupDiagnostic.note("cert-http-first=no-session");
        }
        return browser.findCertificates(query);
    }
}
