package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Scrapes the enforcement-centre certificates JSF page. INERT BY DEFAULT: BeanConfig only creates it when
 * cevoc.scraper.certificates.enabled=true. The page's robots.txt disallows automated access, so production
 * use needs the owner's written approval, and this should be replaced by the real certificate API.
 *
 * <p>Calls are serialised (synchronized) and rate limited by the fetcher; results (including empty ones)
 * are cached briefly. Failures surface as ScrapeException; they are not cached.
 */
public class CertificateScraperAdapter implements CertificateSourcePort {

    private record Cached(Instant at, List<CertificateRef> value) {}

    private final PageFetcher fetcher;
    private final CertificatePageParser parser;
    private final CertificateScraperProperties props;
    private final Clock clock;
    private final Map<String, Cached> cache = new HashMap<>();

    public CertificateScraperAdapter(PageFetcher fetcher, CertificatePageParser parser,
                                     CertificateScraperProperties props, Clock clock) {
        this.fetcher = fetcher;
        this.parser = parser;
        this.props = props;
        this.clock = clock;
    }

    @Override
    public synchronized List<CertificateRef> findCertificates(CertificateQuery query) {
        String key = query.penaltyNumber() + "|" + query.enforcementSiteNumber();
        Cached hit = cache.get(key);
        Instant now = clock.instant();
        if (hit != null && hit.at().plus(props.cacheTtl()).isAfter(now)) return hit.value();
        cache.values().removeIf(c -> !c.at().plus(props.cacheTtl()).isAfter(now));

        List<CertificateRef> result = switch (props.keyStrategy()) {
            case BY_PENALTY -> byPenalty(query);
            case VIA_ENFORCEMENT_SITE -> viaSite(query);
        };
        cache.put(key, new Cached(now, result));
        return result;
    }

    private List<CertificateRef> byPenalty(CertificateQuery q) {
        String html = search(q.penaltyNumber(), q.enforcementSiteNumber());
        return parser.hasNoResults(html) ? List.of() : parser.parseCertificates(html);
    }

    /** penalty -> enforcement site number(s) -> certificates. A site number in the query skips the first step. */
    private List<CertificateRef> viaSite(CertificateQuery q) {
        List<String> sites;
        if (q.enforcementSiteNumber() != null) {
            sites = List.of(q.enforcementSiteNumber());
        } else {
            String html = search(q.penaltyNumber(), null);
            if (parser.hasNoResults(html)) return List.of();
            sites = parser.parseSites(html).stream().map(CertificatePageParser.SiteRef::siteNumber).toList();
        }
        List<CertificateRef> all = new java.util.ArrayList<>();
        for (String site : sites) {
            String html = search(q.penaltyNumber(), site);
            if (!parser.hasNoResults(html)) all.addAll(parser.parseCertificates(html));
        }
        return List.copyOf(all);
    }

    /** Fresh GET each time so the ViewState is current, then one POST. */
    private String search(String penaltyNumber, String siteNumber) {
        String page = fetcher.get(props.pageUrl());
        CertificatePageParser.FormState state = parser.parseForm(page, props.pageUrl());
        return fetcher.postForm(state.actionUrl(), parser.buildSearchPost(state, penaltyNumber, siteNumber));
    }
}
