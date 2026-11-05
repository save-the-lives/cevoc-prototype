package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.io.IOException;
import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Provider {@code search-page}: reads the public certificates SEARCH page (searchCertificates.jsf) in a headless
 * browser session of its own, with the camera code as Location code and the offence window as Date/Time from and to.
 *
 * <p>INTERIM. Approved by the project owner on 2026-11-04 even though the page's robots.txt disallows automated
 * access; to be replaced by the TfNSW API provider through configuration (see docs/DIRECT-API-ROUTE.md). All safeguards
 * stay: off unless configured with an approval reference, polite pacing, honest identifying user agent and contact,
 * and a refusal (401, 403, 429) ends the attempt and is reported as {@code blocked-<status>}, never worked around.
 *
 * <p>Calls are serialised; results (including empty ones) are cached briefly; failures are not cached.
 */
public class SearchPageCertificateSource implements CertificateSourcePort {

    /** The working basint host (the earlier cevoc.transport host answers 403). Override: cevoc.certificates.search-page.url (env CEVOC_CERTIFICATES_SEARCH_PAGE_URL). */
    public static final String DEFAULT_PAGE_URL = CertificateScraperProperties.DEFAULT_PAGE_URL;

    private record Cached(Instant at, List<CertificateRef> value) {}

    private final RenderedPageSessionFactory sessions;
    private final String pageUrl;
    private final CertificatePageParser parser;
    private final Duration cacheTtl;
    private final Clock clock;
    private final Map<String, Cached> cache = new HashMap<>();

    public SearchPageCertificateSource(RenderedPageSessionFactory sessions, String pageUrl, CertificatePageParser parser,
                                       Duration cacheTtl, Clock clock) {
        URI u = URI.create(pageUrl);
        if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null) {
            throw new IllegalArgumentException("the certificates search page address must be https");
        }
        if (cacheTtl.compareTo(Duration.ofMinutes(10)) > 0) {
            throw new IllegalArgumentException("certificates cache must be at most 600 seconds (short cache)");
        }
        this.sessions = sessions;
        this.pageUrl = pageUrl;
        this.parser = parser;
        this.cacheTtl = cacheTtl;
        this.clock = clock;
    }

    @Override
    public synchronized List<CertificateRef> findCertificates(CertificateQuery query) {
        if (query.locationCode() == null || query.locationCode().isBlank() || query.from() == null || query.to() == null) {
            throw new IllegalArgumentException("search-page needs locationCode, from and to");
        }
        String key = query.locationCode() + "|" + query.from() + "|" + query.to();
        Instant now = clock.instant();
        Cached hit = cache.get(key);
        if (hit != null && hit.at().plus(cacheTtl).isAfter(now)) {
            return hit.value();
        }
        cache.values().removeIf(c -> !c.at().plus(cacheTtl).isAfter(now));
        List<CertificateRef> rows;
        try (RenderedPageSession session = sessions.open(URI.create(pageUrl))) {
            Optional<String> html = session.searchCertificates(pageUrl, query.locationCode(), query.from(), query.to());
            if (html.isEmpty() || html.get().isBlank()) {
                throw new ScrapeException("no-search-form");
            }
            rows = RenderedCertificates.parse(parser, html.get());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ScrapeException("interrupted");
        } catch (IOException e) {
            String reason = LookupDiagnostic.fromFailure(e.getMessage());
            String cause = reason.substring(reason.indexOf("cause=") + 6);
            LookupDiagnostic.note(LookupDiagnostic.certStep("failed", cause));
            if (cause.startsWith("ERR_NAME_NOT_RESOLVED") || cause.startsWith("ERR_CONNECTION") || cause.startsWith("ERR_INTERNET")) {
                // Name or connection failure: add the redacted DNS view of the page host (kinds, counts, timings only).
                LookupDiagnostic.note("cert-host-dns=" + HostReachability.line(HostReachability.hostOf(pageUrl)).trim().replace(" : ", " "));
            }
            // The browser layer already scrubbed the message and keeps it to one line (cause words such as blocked-403).
            throw new ScrapeException(e.getMessage() == null ? "failed" : e.getMessage().lines().findFirst().orElse("failed"));
        }
        LookupDiagnostic.note("cert-provider=search-page");
        cache.put(key, new Cached(now, rows));
        return rows;
    }
}
