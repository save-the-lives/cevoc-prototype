package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/**
 * Provider {@code search-page-http}: the certificates SEARCH page with plain HTTP and no browser. GET the page, read the
 * JSF hidden fields (view state, form id) and the field names from it, POST the search form with the camera code as
 * Location code and the offence window as Date/Time from and to, parse the result table.
 *
 * <p>INTERIM, like {@code search-page}: approved by the project owner on 2026-11-04 although robots.txt disallows
 * automated access; replaced by the TfNSW API provider through configuration. Safeguards: off unless configured with an
 * approval reference, one lookup at a time, minimum gap between requests, honest identifying user agent with contact,
 * session cookie in memory for that one lookup only (a fresh fetcher each time), and a refusal (401, 403, 429) or a
 * captcha ends the attempt as {@code blocked-<status>} / {@code captcha} and is never worked around.
 */
public class SearchPageHttpCertificateSource implements CertificateSourcePort {

    private record Cached(Instant at, List<CertificateRef> value) {}

    private final Supplier<PageFetcher> fetchers;
    private final String pageUrl;
    private final CertificatePageParser parser;
    private final EvidenceRateLimiter limiter;
    private final Duration cacheTtl;
    private final Clock clock;
    private final Map<String, Cached> cache = new HashMap<>();

    public SearchPageHttpCertificateSource(Supplier<PageFetcher> fetchers, String pageUrl, CertificatePageParser parser,
                                           EvidenceRateLimiter limiter, Duration cacheTtl, Clock clock) {
        URI u = URI.create(pageUrl);
        if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null) {
            throw new IllegalArgumentException("the certificates search page address must be https");
        }
        if (cacheTtl.compareTo(Duration.ofMinutes(10)) > 0) {
            throw new IllegalArgumentException("certificates cache must be at most 600 seconds (short cache)");
        }
        this.fetchers = fetchers;
        this.pageUrl = pageUrl;
        this.parser = parser;
        this.limiter = limiter;
        this.cacheTtl = cacheTtl;
        this.clock = clock;
    }

    @Override
    public synchronized List<CertificateRef> findCertificates(CertificateQuery query) {
        if (query.locationCode() == null || query.locationCode().isBlank() || query.from() == null || query.to() == null) {
            throw new IllegalArgumentException("search-page-http needs locationCode, from and to");
        }
        String key = query.locationCode() + "|" + query.from() + "|" + query.to();
        Instant now = clock.instant();
        Cached hit = cache.get(key);
        if (hit != null && hit.at().plus(cacheTtl).isAfter(now)) {
            return hit.value();
        }
        cache.values().removeIf(c -> !c.at().plus(cacheTtl).isAfter(now));
        List<CertificateRef> rows;
        try {
            PageFetcher fetcher = fetchers.get();
            limiter.acquire();
            String form = fetcher.get(pageUrl);
            LookupDiagnostic.note("srch-http-form: " + SearchPageDiagnostic.structureOf(form));
            if (SearchPageDiagnostic.hasCaptcha(form)) {
                throw new ScrapeException("captcha present: stopping, not automating past it");
            }
            SearchFormReader.Plan plan = SearchFormReader.plan(form, pageUrl, query.locationCode(), query.from(), query.to());
            LookupDiagnostic.note("srch-http-found: " + plan.how() + "; post-fields=" + Math.min(plan.body().size(), 99));
            limiter.acquire();
            String result = fetcher.postForm(plan.actionUrl(), plan.body());
            LookupDiagnostic.note("srch-http-result: " + SearchPageDiagnostic.structureOf(result));
            if (SearchPageDiagnostic.hasCaptcha(result)) {
                throw new ScrapeException("captcha present: stopping, not automating past it");
            }
            rows = RenderedCertificates.parse(parser, result);
        } catch (IllegalStateException e) {
            Thread.currentThread().interrupt();
            throw new ScrapeException("interrupted");
        } catch (ScrapeException e) {
            String reason = LookupDiagnostic.fromFailure(e.getMessage());
            LookupDiagnostic.note(LookupDiagnostic.certStep("failed", reason.substring(reason.indexOf("cause=") + 6)));
            throw e;
        }
        LookupDiagnostic.note("cert-provider=search-page-http");
        cache.put(key, new Cached(now, rows));
        return rows;
    }
}
