package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult.Status;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * NOT FOR PRODUCTION WITHOUT THE SITE OWNER'S WRITTEN APPROVAL. Prototype only; replace with the real
 * evidence API. See docs/ARCHITECTURE.md ("Scraper adapter").
 *
 * Looks a notice up on the Revenue NSW penalty page, copies each image/video into storage through
 * MediaStoragePort and returns object keys (links are then made by SignedLinkPort as usual).
 * Does nothing at all (no network) unless cevoc.scraper.evidence.enabled=true, a base URL and a contact are set,
 * and cevoc.penalty-lookup.adapter=scraper-evidence. Requests are sequential and rate limited.
 */
public class ScraperEvidenceLookupAdapter implements PenaltyLookupPort {

    static final String SOURCE = "SCRAPER_EVIDENCE";
    private static final Pattern NOTICE_NUMBER = Pattern.compile("[A-Za-z0-9]{4,20}");
    private static final int MAX_CACHE_ENTRIES = 100;

    private record CacheEntry(PenaltyLookupResult result, Instant expiresAt) {}

    private final ScraperSettings settings;
    private final EvidencePageFetcher fetcher;
    private final RevenueNswPageParser parser;
    private final MediaStoragePort storage;
    private final Clock clock;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public ScraperEvidenceLookupAdapter(ScraperSettings settings, EvidencePageFetcher fetcher, RevenueNswPageParser parser,
                                        MediaStoragePort storage, Clock clock) {
        this.settings = settings;
        this.fetcher = fetcher;
        this.parser = parser;
        this.storage = storage;
        this.clock = clock;
    }

    /** synchronized: one lookup at a time, so no parallel hits on the site. */
    @Override
    public synchronized PenaltyLookupResult find(PenaltyLookupRequest request) {
        String number = request.infringementNumber();
        if (!settings.usable()) {
            return result(Status.LIVE_LOOKUP_OFF, number, "Looking up this notice is switched off for now, until approvals are in place.");
        }
        if (number == null || !NOTICE_NUMBER.matcher(number).matches() || request.offenceDate() == null) {
            return result(Status.NOT_FOUND, number, "We could not match that notice number and offence date.");
        }
        String key = sha(number.toUpperCase(Locale.ROOT) + "|" + request.offenceDate());
        CacheEntry cached = cache.get(key);
        if (cached != null && cached.expiresAt().isAfter(clock.instant())) {
            return cached.result();
        }
        try {
            URI base = URI.create(settings.baseUrl());
            if (!"https".equalsIgnoreCase(base.getScheme()) || base.getHost() == null) {
                return result(Status.UNAVAILABLE, number, "The lookup source is not configured correctly.");
            }
            EvidencePageFetcher.Response page = fetcher.get(searchUri(base, number, request));
            if (page.status() != 200) {
                return result(Status.UNAVAILABLE, number, "The lookup source is not available right now.");
            }
            RevenueNswPageParser.Parsed parsed = parser.parse(new String(page.body(), StandardCharsets.UTF_8));
            PenaltyLookupResult out = switch (parsed.outcome()) {
                case NOT_FOUND -> result(Status.NOT_FOUND, number, "We could not match that notice number and offence date.");
                case UNRECOGNISED -> result(Status.UNAVAILABLE, number, "The lookup source returned something we could not read.");
                case FOUND -> new PenaltyLookupResult(Status.FOUND, number, "Content from the penalty page.", parsed.notice(),
                        buffer(base, key, parsed.media()), SOURCE);
            };
            if (out.status() == Status.FOUND || out.status() == Status.NOT_FOUND) {
                remember(key, out);
            }
            return out;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return result(Status.UNAVAILABLE, number, "The lookup was interrupted.");
        } catch (IOException | RuntimeException e) {
            return result(Status.UNAVAILABLE, number, "The lookup source is not available right now.");
        }
    }

    /** TODO (needs the real page): how the two inputs are submitted (GET query, POST form, token). Fictitious GET here. */
    private static URI searchUri(URI base, String number, PenaltyLookupRequest r) {
        String sep = base.getQuery() == null ? "?" : "&";
        return URI.create(base + sep + "noticeNumber=" + enc(number) + "&offenceDate=" + enc(r.offenceDate().toString()));
    }

    /** Copies each media item into storage; skips items that are off-host, non-https, oversize or fail. */
    private List<EvidenceItem> buffer(URI base, String key, List<RevenueNswPageParser.MediaRef> refs) throws InterruptedException {
        List<EvidenceItem> items = new ArrayList<>();
        int n = 0;
        for (RevenueNswPageParser.MediaRef ref : refs) {
            n++;
            try {
                URI uri = base.resolve(ref.src());
                if (!"https".equalsIgnoreCase(uri.getScheme()) || !base.getHost().equalsIgnoreCase(uri.getHost())) {
                    continue; // never follow media to another host
                }
                EvidencePageFetcher.Response media = fetcher.get(uri);
                String type = media.contentType() == null ? "" : media.contentType().split(";")[0].trim().toLowerCase(Locale.ROOT);
                String prefix = ref.kind() == EvidenceItem.Kind.IMAGE ? "image/" : "video/";
                if (media.status() != 200 || !type.startsWith(prefix) || media.body().length == 0) {
                    continue;
                }
                String objectKey = "scraped/" + key.substring(0, 16) + "/" + ref.kind().name().toLowerCase(Locale.ROOT)
                        + "-" + n + extension(type);
                storage.store(objectKey, type, new ByteArrayInputStream(media.body()), media.body().length);
                items.add(EvidenceItem.ofObject(ref.kind(), ref.title(), objectKey));
            } catch (IOException | RuntimeException e) {
                // skip this item; the notice details are still useful
            }
        }
        return items;
    }

    private void remember(String key, PenaltyLookupResult out) {
        Instant now = clock.instant();
        if (cache.size() >= MAX_CACHE_ENTRIES) {
            cache.values().removeIf(e -> !e.expiresAt().isAfter(now));
            if (cache.size() >= MAX_CACHE_ENTRIES) {
                cache.clear();
            }
        }
        cache.put(key, new CacheEntry(out, now.plus(settings.cacheTtl())));
    }

    private static String extension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            case "video/mp4" -> ".mp4";
            case "video/webm" -> ".webm";
            default -> ".bin";
        };
    }

    private static PenaltyLookupResult result(Status status, String number, String summary) {
        return new PenaltyLookupResult(status, number, summary, null, List.of(), SOURCE);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    private static String sha(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
