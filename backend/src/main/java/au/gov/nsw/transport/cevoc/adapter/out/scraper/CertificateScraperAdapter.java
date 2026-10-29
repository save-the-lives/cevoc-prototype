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
        String key = query.penaltyNumber() + "|" + query.locationCode() + "|" + query.from() + "|" + query.to();
        Cached hit = cache.get(key);
        Instant now = clock.instant();
        if (hit != null && hit.at().plus(props.cacheTtl()).isAfter(now)) return hit.value();
        cache.values().removeIf(c -> !c.at().plus(props.cacheTtl()).isAfter(now));

        List<CertificateRef> result = switch (props.keyStrategy()) {
            case VIA_ENFORCEMENT_SITE -> byLocationAndWindow(query);
            case BY_PENALTY -> byPenalty(query);
        };
        cache.put(key, new Cached(now, result));
        return result;
    }

    /** Real page: location code + date/time range, one search. The caller resolves penalty -> location code. */
    private List<CertificateRef> byLocationAndWindow(CertificateQuery q) {
        if (q.locationCode() == null || q.from() == null || q.to() == null) {
            throw new IllegalArgumentException("VIA_ENFORCEMENT_SITE needs locationCode, from and to");
        }
        String html = search(state -> parser.buildSearchPost(state, q.locationCode(), q.from(), q.to()));
        return parser.hasNoResults(html) ? List.of() : parser.parseCertificates(html);
    }

    /** Unsupported by the real page; kept for fictitious fixtures only. */
    private List<CertificateRef> byPenalty(CertificateQuery q) {
        if (q.penaltyNumber() == null) throw new IllegalArgumentException("BY_PENALTY needs penaltyNumber");
        String html = search(state -> parser.buildPenaltySearchPost(state, q.penaltyNumber()));
        return parser.hasNoResults(html) ? List.of() : parser.parseCertificates(html);
    }

    /** Fresh GET each time so the ViewState is current, then one POST. */
    private String search(java.util.function.Function<CertificatePageParser.FormState, Map<String, String>> body) {
        String page = fetcher.get(props.pageUrl());
        CertificatePageParser.FormState state = parser.parseForm(page, props.pageUrl());
        return fetcher.postForm(state.actionUrl(), body.apply(state));
    }
}
