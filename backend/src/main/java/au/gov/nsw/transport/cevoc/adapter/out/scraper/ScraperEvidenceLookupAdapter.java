package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult.Status;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * NOT FOR PRODUCTION WITHOUT THE SITE OWNER'S WRITTEN APPROVAL. Prototype only; replace with the real
 * evidence API. See docs/ARCHITECTURE.md ("Scraper adapter").
 *
 * Drives the three-state myPenalty flow through a {@link RenderedPageSession} (the site is an Angular app, so
 * only a rendered DOM is useful): login page, then notice summary, then (with a registration) the images page.
 * Images are blob: URLs inside the session, so their bytes are read from the same session and copied into
 * storage through MediaStoragePort; links are then made by SignedLinkPort as usual.
 * Does nothing at all (no browser, no network) unless cevoc.scraper.evidence.enabled=true, a base URL and a
 * contact are set, and cevoc.penalty-lookup.adapter=scraper-evidence.
 *
 * The registration is transient: held in a local variable for one request, passed to the session, then dropped.
 * It is never logged (log lines below carry no request values), cached, stored, or part of a cache or storage key.
 */
public class ScraperEvidenceLookupAdapter implements PenaltyLookupPort {

    static final String SOURCE = "SCRAPER_EVIDENCE";
    private static final Logger LOG = LoggerFactory.getLogger(ScraperEvidenceLookupAdapter.class);
    private static final Pattern NOTICE_NUMBER = Pattern.compile("[A-Za-z0-9]{4,20}");
    private static final DateTimeFormatter LOGIN_DATE = DateTimeFormatter.ofPattern("dd/MM/uuuu", Locale.ENGLISH);
    private static final int MAX_CACHE_ENTRIES = 100;
    private static final int MAX_IMAGES = 20;

    private record CacheEntry(PenaltyLookupResult result, Instant expiresAt) {}

    private final ScraperSettings settings;
    private final RenderedPageSessionFactory sessions;
    private final RevenueNswPageParser parser;
    private final MediaStoragePort storage;
    private final Clock clock;
    private final RegistrationProvider registrations;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public ScraperEvidenceLookupAdapter(ScraperSettings settings, RenderedPageSessionFactory sessions, RevenueNswPageParser parser,
                                        MediaStoragePort storage, Clock clock) {
        this(settings, sessions, parser, storage, clock, RegistrationProvider.none());
    }

    public ScraperEvidenceLookupAdapter(ScraperSettings settings, RenderedPageSessionFactory sessions, RevenueNswPageParser parser,
                                        MediaStoragePort storage, Clock clock, RegistrationProvider registrations) {
        this.registrations = registrations;
        this.settings = settings;
        this.sessions = sessions;
        this.parser = parser;
        this.storage = storage;
        this.clock = clock;
    }

    /** synchronized: one lookup (one browser session) at a time, so no parallel hits on the site. */
    @Override
    public synchronized PenaltyLookupResult find(PenaltyLookupRequest request) {
        String number = request.infringementNumber();
        if (!settings.usable()) {
            return result(Status.LIVE_LOOKUP_OFF, number, "Looking up this notice is switched off for now, until approvals are in place.");
        }
        if (number == null || !NOTICE_NUMBER.matcher(number).matches() || request.offenceDate() == null) {
            return result(Status.NOT_FOUND, number, "We could not match that notice number and offence date.");
        }
        // The cache key is the notice and date only. The plate is never part of it.
        String key = sha(number.toUpperCase(Locale.ROOT) + "|" + request.offenceDate());
        String plate = normalisePlate(registrations.registrationFor(request).orElse(null));
        CacheEntry cached = plate == null ? cache.get(key) : null;
        if (cached != null && cached.expiresAt().isAfter(clock.instant())) {
            return cached.result();
        }
        URI base = URI.create(settings.baseUrl());
        if (!"https".equalsIgnoreCase(base.getScheme()) || base.getHost() == null) {
            return result(Status.UNAVAILABLE, number, "The lookup source is not configured correctly.");
        }
        try (RenderedPageSession session = sessions.open(base)) {
            PenaltyLookupResult out = run(session, key, number, request, plate);
            // Anything that carried evidence (or needed a plate) is never cached.
            if (plate == null && out.evidence().isEmpty() && (out.status() == Status.FOUND || out.status() == Status.NOT_FOUND)) {
                remember(key, out);
            }
            return out;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOG.warn("evidence lookup interrupted");
            return result(Status.UNAVAILABLE, number, "The lookup was interrupted.");
        } catch (IOException | RuntimeException e) {
            // Class name only: messages from a browser layer could echo form values.
            LOG.warn("evidence lookup failed: {}", e.getClass().getSimpleName());
            return result(Status.UNAVAILABLE, number, "The lookup source is not available right now.");
        }
    }

    private PenaltyLookupResult run(RenderedPageSession session, String key, String number, PenaltyLookupRequest request, String plate)
            throws IOException, InterruptedException {
        // State 1: login page. A notice type that needs extra identity fields is out of scope.
        RevenueNswPageParser.Page login = parser.parse(session.loginPage());
        if (login.state() != RevenueNswPageParser.State.LOGIN) {
            LOG.warn("evidence lookup: login page not recognised");
            return result(Status.UNAVAILABLE, number, "The lookup source returned something we could not read.");
        }
        if (!login.unexpectedLoginFields().isEmpty()) {
            LOG.warn("evidence lookup: login page asks for extra details");
            return result(Status.UNAVAILABLE, number, "This kind of notice needs details we do not collect.");
        }
        // State 2: summary. Still on the login page means the pair was not matched (OPEN QUESTION: the real wording).
        RevenueNswPageParser.Page page = parser.parse(session.submitLogin(number, request.offenceDate().format(LOGIN_DATE)));
        switch (page.state()) {
            case LOGIN -> {
                return result(Status.NOT_FOUND, number, "We could not match that notice number and offence date.");
            }
            case UNRECOGNISED -> {
                LOG.warn("evidence lookup: summary page not recognised");
                return result(Status.UNAVAILABLE, number, "The lookup source returned something we could not read.");
            }
            default -> { /* SUMMARY or IMAGES: carry on */ }
        }
        if (page.noticeNumber() != null && !page.noticeNumber().equalsIgnoreCase(number)) {
            LOG.warn("evidence lookup: page shows a different notice number");
            return result(Status.UNAVAILABLE, number, "The lookup source returned something we could not read.");
        }
        String summary = "Content from the penalty page.";
        // State 3: only with a plate and a plate form still on the page.
        if (page.state() == RevenueNswPageParser.State.SUMMARY && plate != null && page.plateFormPresent()) {
            RevenueNswPageParser.Page after = parser.parse(session.submitPlate(plate));
            if (after.state() == RevenueNswPageParser.State.IMAGES) {
                page = after;
            } else {
                // OPEN QUESTION: what the site shows for a wrong plate is unknown. Plate form still there, or
                // anything that is not the images state, is reported as one generic "not accepted" result.
                LOG.info("evidence lookup: registration not accepted");
                summary = "Notice details found. The registration number was not accepted, so no images are shown.";
            }
        }
        List<EvidenceItem> evidence = page.state() == RevenueNswPageParser.State.IMAGES
                ? buffer(session, key, page.images()) : List.of();
        NoticeDetails notice = page.notice();
        if (!evidence.isEmpty() && notice.enforcementMethod() != EnforcementMethod.CAMERA) {
            notice = new NoticeDetails(notice.offenceDescription(), notice.offenceDate(), notice.offenceTime(), notice.location(),
                    notice.penaltyAmount(), notice.amountOwing(), notice.noticeStatus(), notice.statusMessage(), EnforcementMethod.CAMERA);
        }
        // cameraCode is internal (@JsonIgnore): input for the certificate lookup, banner first, then the s= value.
        return new PenaltyLookupResult(Status.FOUND, number, summary, notice, evidence, SOURCE, page.cameraCode());
    }

    /** Upper-cases and strips spaces and dashes; null when blank or not plausibly a plate. */
    private static String normalisePlate(String raw) {
        if (raw == null) {
            return null;
        }
        String p = raw.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        return p.matches("[A-Z0-9]{1,8}") ? p : null;
    }

    /**
     * Copies each image's bytes (read from the same browser session) into storage. Only blob: handles are
     * accepted; anything else is skipped so this adapter never fetches from elsewhere. Object keys derive from
     * the notice hash and a counter, never from the plate or the image ref.
     */
    private List<EvidenceItem> buffer(RenderedPageSession session, String key, List<RevenueNswPageParser.ImageRef> refs)
            throws InterruptedException {
        List<EvidenceItem> items = new ArrayList<>();
        int n = 0;
        for (RevenueNswPageParser.ImageRef ref : refs) {
            if (n >= MAX_IMAGES) {
                break;
            }
            n++;
            if (ref.blobUrl() == null || !ref.blobUrl().startsWith("blob:")) {
                continue;
            }
            try {
                Optional<RenderedPageSession.ImageBytes> bytes = session.imageBytes(ref.blobUrl());
                if (bytes.isEmpty()) {
                    continue;
                }
                byte[] data = bytes.get().data();
                String type = bytes.get().contentType() == null ? ""
                        : bytes.get().contentType().split(";")[0].trim().toLowerCase(Locale.ROOT);
                if (data == null || data.length == 0 || data.length > settings.maxBytes() || !type.startsWith("image/")) {
                    continue;
                }
                String objectKey = "scraped/" + key.substring(0, 16) + "/image-" + n + extension(type);
                storage.store(objectKey, type, new ByteArrayInputStream(data), data.length);
                items.add(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Camera image " + ref.ref(), objectKey));
            } catch (IOException | RuntimeException e) {
                LOG.debug("evidence image skipped: {}", e.getClass().getSimpleName());
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

    private static String sha(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
