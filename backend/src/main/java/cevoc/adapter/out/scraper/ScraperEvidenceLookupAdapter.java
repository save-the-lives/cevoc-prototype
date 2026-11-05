package cevoc.adapter.out.scraper;

import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.MediaStoragePort;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.EnforcementMethod;
import cevoc.domain.EvidenceItem;
import cevoc.domain.ImageSize;
import cevoc.domain.LookupStep;
import cevoc.domain.LookupTrace;
import cevoc.domain.StepCause;
import cevoc.domain.NoticeDetails;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.PenaltyLookupResult.Status;
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
    /** Bounds for reading the page after submit-login (package-private so tests can shorten them). */
    java.time.Duration summaryWait = java.time.Duration.ofSeconds(20);
    java.time.Duration loginWait = java.time.Duration.ofSeconds(4);
    java.time.Duration pollInterval = java.time.Duration.ofMillis(250);
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();
    /** Legacy provider browser-link: follow the page's signed certification link. Off by default (it answers 403). */
    private volatile boolean followCertificationLink;

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

    public ScraperEvidenceLookupAdapter followCertificationLink(boolean follow) {
        this.followCertificationLink = follow;
        return this;
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        return find(request, LookupProgress.NONE);
    }

    /**
     * synchronized: one lookup (one browser session) at a time, so no parallel hits on the site. {@code progress} is
     * told when the notice details are known and when the images are stored, while the lookup is still running.
     */
    @Override
    public synchronized PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
        String number = request.infringementNumber();
        CertificateHandoff.clear();
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
            LookupDiagnostic.set("step=config; cause=base-url-not-https");
            LookupTrace.current().fail(LookupStep.START_BROWSER, StepCause.NOT_CONFIGURED);
            return result(Status.UNAVAILABLE, number, "The lookup source is not configured correctly.");
        }
        LookupTrace trace = LookupTrace.current();
        RenderedPageSession session = null;
        try {
            session = trace.run(LookupStep.START_BROWSER, () -> sessions.open(base));
            PenaltyLookupResult out = run(session, key, number, request, plate, progress);
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
            LookupDiagnostic.set(LookupDiagnostic.fromFailure(e instanceof IOException ? e.getMessage() : "failed: " + e.getClass().getSimpleName()));
            if (trace.firstFailed() == null) {
                // A failure outside a timed step (for example while reading a page): name the step it was in.
                trace.fail(inFlight(trace), StepCause.of(e));
            }
            return result(Status.UNAVAILABLE, number, "The lookup source is not available right now.");
        } finally {
            if (session != null) {
                session.close();
            }
        }
    }

    /** The first step with no recorded outcome yet. */
    private static LookupStep inFlight(LookupTrace trace) {
        return trace.entries().stream().filter(e -> e.cause() == StepCause.NOT_APPLICABLE).map(LookupTrace.Entry::step)
                .findFirst().orElse(LookupStep.START_BROWSER);
    }

    private PenaltyLookupResult run(RenderedPageSession session, String key, String number, PenaltyLookupRequest request, String plate,
                                    LookupProgress progress)
            throws IOException, InterruptedException {
        LookupTrace trace = LookupTrace.current();
        // State 1: login page. A notice type that needs extra identity fields is out of scope.
        String loginHtml = trace.run(LookupStep.OPEN_LOGIN, session::loginPage);
        RevenueNswPageParser.Page login = parser.parse(loginHtml);
        if (login.state() != RevenueNswPageParser.State.LOGIN) {
            LOG.warn("evidence lookup: login page not recognised");
            trace.fail(LookupStep.OPEN_LOGIN, StepCause.PAGE_NOT_RECOGNISED);
            LookupDiagnostic.set(LookupDiagnostic.fromUnreadablePage("login", loginHtml));
            return result(Status.UNAVAILABLE, number, "The lookup source returned something we could not read.");
        }
        if (!login.unexpectedLoginFields().isEmpty()) {
            LOG.warn("evidence lookup: login page asks for extra details");
            trace.fail(LookupStep.OPEN_LOGIN, StepCause.EXTRA_LOGIN_FIELDS);
            LookupDiagnostic.set("step=login; cause=extra-login-fields");
            return result(Status.UNAVAILABLE, number, "This kind of notice needs details we do not collect.");
        }
        // State 2: summary. Still on the login page means the pair was not matched (OPEN QUESTION: the real wording).
        String summaryHtml = trace.run(LookupStep.SUBMIT_LOGIN,
                () -> session.submitLogin(number, request.offenceDate().format(LOGIN_DATE)));
        long readStart = System.nanoTime();
        RevenueNswPageParser.Page page = parser.parse(summaryHtml);
        // The Angular summary can render late (its GET sometimes hangs): keep reading until a recognised state or the bound.
        if (page.state() == RevenueNswPageParser.State.LOGIN || page.state() == RevenueNswPageParser.State.UNRECOGNISED) {
            boolean unrecognised = page.state() == RevenueNswPageParser.State.UNRECOGNISED;
            long deadline = readStart + (unrecognised ? summaryWait : loginWait).toNanos();
            while (System.nanoTime() < deadline
                    && (page.state() == RevenueNswPageParser.State.LOGIN || page.state() == RevenueNswPageParser.State.UNRECOGNISED)) {
                Thread.sleep(pollInterval.toMillis());
                Optional<String> again = session.currentPage();
                if (again.isEmpty()) {
                    break;
                }
                summaryHtml = again.get();
                page = parser.parse(summaryHtml);
            }
        }
        trace.ok(LookupStep.READ_SUMMARY, (System.nanoTime() - readStart) / 1_000_000);
        switch (page.state()) {
            case LOGIN -> {
                trace.fail(LookupStep.READ_SUMMARY, StepCause.NOT_MATCHED);
                LookupDiagnostic.note("after-next " + LookupDiagnostic.structureOf(summaryHtml));
                return result(Status.NOT_FOUND, number, "We could not match that notice number and offence date.");
            }
            case UNRECOGNISED -> {
                LOG.warn("evidence lookup: summary page not recognised");
                // An empty shell after the full wait means the summary never rendered; other content is a settled, unknown page.
                boolean empty = org.jsoup.Jsoup.parse(summaryHtml).body().text().isBlank();
                trace.fail(LookupStep.READ_SUMMARY, empty ? StepCause.SUMMARY_TIMEOUT : StepCause.PAGE_NOT_RECOGNISED);
                LookupDiagnostic.set(LookupDiagnostic.fromUnreadablePage("summary", summaryHtml));
                return result(Status.UNAVAILABLE, number, "The lookup source returned something we could not read.");
            }
            default -> { /* SUMMARY or IMAGES: carry on */ }
        }
        if (page.noticeNumber() != null && !page.noticeNumber().equalsIgnoreCase(number)) {
            LOG.warn("evidence lookup: page shows a different notice number");
            trace.fail(LookupStep.READ_SUMMARY, StepCause.NOTICE_MISMATCH);
            LookupDiagnostic.set("step=summary; cause=notice-number-mismatch");
            return result(Status.UNAVAILABLE, number, "The lookup source returned something we could not read.");
        }
        String summary = "Content from the penalty page.";
        // The source releases the images only once the registration is given: a plate form on the summary and no plate
        // means images exist but are held back. Yes/no only; the plate itself is never echoed.
        boolean plateRequired = page.state() == RevenueNswPageParser.State.SUMMARY && plate == null && page.plateFormPresent();
        // Notice details are known now (about seven seconds in): let a streaming caller show them while the rest runs.
        NoticeDetails early = plateRequired ? asCamera(page.notice()) : page.notice();
        progress.details(new PenaltyLookupResult(Status.FOUND, number, summary, early, List.of(), SOURCE, page.cameraCode(),
                List.of(), null, plateRequired));
        // State 3: only with a plate and a plate form still on the page.
        LookupDiagnostic.note("plate-given=" + (plate != null ? "yes" : "no") + "; plate-form=" + (page.plateFormPresent() ? "yes" : "no")
                + "; summary-state=" + page.state());
        if (page.state() == RevenueNswPageParser.State.SUMMARY && plate != null && page.plateFormPresent()) {
            String afterHtml = trace.run(LookupStep.GIVE_PLATE, () -> session.submitPlate(plate));
            long viewStart = System.nanoTime();
            RevenueNswPageParser.Page after = parser.parse(afterHtml);
            trace.ok(LookupStep.VIEW_IMAGES, (System.nanoTime() - viewStart) / 1_000_000);
            LookupDiagnostic.note("after-plate-state=" + after.state() + "; " + LookupDiagnostic.structureOf(afterHtml));
            if (after.state() == RevenueNswPageParser.State.IMAGES) {
                page = after;
            } else {
                // OPEN QUESTION: what the site shows for a wrong plate is unknown. Plate form still there, or
                // anything that is not the images state, is reported as one generic "not accepted" result.
                LOG.info("evidence lookup: registration not accepted");
                trace.fail(LookupStep.VIEW_IMAGES, StepCause.PLATE_NOT_ACCEPTED);
                summary = "Notice details found. The registration number was not accepted, so no images are shown.";
            }
        } else if (page.state() != RevenueNswPageParser.State.IMAGES) {
            trace.skip(LookupStep.GIVE_PLATE, plate == null ? StepCause.NO_PLATE : StepCause.NO_PLATE_FORM);
            trace.skip(LookupStep.VIEW_IMAGES, plate == null ? StepCause.NO_PLATE : StepCause.NO_PLATE_FORM);
        }
        List<EvidenceItem> evidence = List.of();
        if (page.state() == RevenueNswPageParser.State.IMAGES) {
            evidence = buffer(session, key, page.images());
            progress.evidence(evidence, false);
        } else {
            progress.evidence(List.of(), plateRequired);
            trace.skip(LookupStep.CAPTURE_IMAGES, trace.firstFailed() != null ? StepCause.PRIOR_FAILURE : StepCause.NO_IMAGES);
        }
        if (followCertificationLink) {
            followCertification(session, page);
        }
        NoticeDetails notice = page.notice();
        if (!evidence.isEmpty() || plateRequired) {
            notice = asCamera(notice);
        }
        // cameraCode is internal (@JsonIgnore): input for the certificate lookup, banner first, then the s= value.
        return new PenaltyLookupResult(Status.FOUND, number, summary, notice, evidence, SOURCE, page.cameraCode(),
                List.of(), null, plateRequired && evidence.isEmpty(), new java.util.LinkedHashMap<>(page.details()));
    }

    private static NoticeDetails asCamera(NoticeDetails notice) {
        if (notice == null || notice.enforcementMethod() == EnforcementMethod.CAMERA) {
            return notice;
        }
        return new NoticeDetails(notice.offenceDescription(), notice.offenceDate(), notice.offenceTime(), notice.location(),
                notice.penaltyAmount(), notice.amountOwing(), notice.noticeStatus(), notice.statusMessage(), EnforcementMethod.CAMERA);
    }

    /**
     * After the images state: follows the page's certification link in the SAME session and hands the rendered
     * certificates page to the certificate source through {@link CertificateHandoff}. Never fails the lookup; the
     * outcome is recorded as a fixed-vocabulary step (outcome ok|failed|skipped plus a whitelisted cause token).
     */
    private static void followCertification(RenderedPageSession session, RevenueNswPageParser.Page page) throws InterruptedException {
        LookupTrace trace = LookupTrace.current();
        if (page.state() != RevenueNswPageParser.State.IMAGES) {
            LookupDiagnostic.note(LookupDiagnostic.certStep("skipped", "no-images"));
            trace.skip(LookupStep.CERTIFICATES, StepCause.NO_IMAGES);
            return;
        }
        if (page.certification() == null) {
            LookupDiagnostic.note(LookupDiagnostic.certStep("skipped", "no-link"));
            trace.skip(LookupStep.CERTIFICATES, StepCause.NO_CERTIFICATION_LINK);
            return;
        }
        long start = System.nanoTime();
        try {
            Optional<String> html = session.openCertification();
            trace.ok(LookupStep.CERTIFICATES, (System.nanoTime() - start) / 1_000_000);
            if (html.isEmpty() || html.get().isBlank()) {
                LookupDiagnostic.note(LookupDiagnostic.certStep("failed", "no-page"));
                trace.fail(LookupStep.CERTIFICATES, StepCause.PAGE_NOT_RECOGNISED);
                return;
            }
            CertificateHandoff.put(html.get());
            LookupDiagnostic.note(LookupDiagnostic.certStep("ok", null));
            LookupDiagnostic.note(LookupDiagnostic.certPageStructureOf(html.get()));
        } catch (IOException | RuntimeException e) {
            LOG.warn("certification page failed: {}", e.getClass().getSimpleName());
            String reason = LookupDiagnostic.fromFailure(e instanceof IOException ? e.getMessage() : "failed: " + e.getClass().getSimpleName());
            LookupDiagnostic.note(LookupDiagnostic.certStep("failed", reason.substring(reason.indexOf("cause=") + 6)));
            trace.ok(LookupStep.CERTIFICATES, (System.nanoTime() - start) / 1_000_000);
            trace.fail(LookupStep.CERTIFICATES, StepCause.of(e));
        }
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
        LookupTrace trace = LookupTrace.current();
        long startNanos = System.nanoTime();
        List<EvidenceItem> items = new ArrayList<>();
        int n = 0;
        int noBytes = 0;
        int rejected = 0;
        int failed = 0;
        for (RevenueNswPageParser.ImageRef ref : refs) {
            if (n >= MAX_IMAGES) {
                break;
            }
            n++;
            if (ref.blobUrl() == null || !ref.blobUrl().startsWith("blob:")) {
                continue;
            }
            try {
                // The source's own response body first (original bytes, untouched); the rendered-page copy only as a fallback.
                Optional<RenderedPageSession.ImageBytes> bytes = session.originalImage(ref.ref(), ref.blobUrl());
                if (bytes.isEmpty()) {
                    bytes = session.imageBytes(ref.blobUrl());
                }
                if (bytes.isEmpty()) {
                    noBytes++;
                    continue;
                }
                byte[] data = bytes.get().data();
                String type = bytes.get().contentType() == null ? ""
                        : bytes.get().contentType().split(";")[0].trim().toLowerCase(Locale.ROOT);
                if (data == null || data.length == 0 || data.length > settings.maxBytes() || !type.startsWith("image/")) {
                    rejected++;
                    continue;
                }
                String objectKey = "scraped/" + key.substring(0, 16) + "/image-" + n + extension(type);
                storage.store(objectKey, type, new ByteArrayInputStream(data), data.length);
                trace.image(sizeOf(bytes.get(), type), type, data);
                EvidenceItem item = EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Camera image " + ref.ref(), objectKey);
                int[] px = pixelsOf(data);
                if (bytes.get().size() != null && bytes.get().size().path() != cevoc.domain.CapturePath.RESPONSE
                        && px != null && Math.max(px[0], px[1]) < 400) {
                    if (bytes.get().size().path() == cevoc.domain.CapturePath.FETCH) {
                        // The page's own object bytes, untouched, and the page never asked for a larger version: the original is small.
                        LookupDiagnostic.note("image-" + n + "-original-small (page object bytes untouched; no larger version requested)");
                    } else {
                        // No original body was obtained for this one: what is stored is the small preview, and it is marked as such.
                        LookupDiagnostic.note("image-" + n + "-thumbnail-only");
                    }
                }
                if (px == null) {
                    // Why the JDK cannot read this one: first bytes as hex (file signature only) and the decoder's exception class.
                    LookupDiagnostic.note("image-" + n + "-undecodable: magic=" + HexFormat.of().formatHex(data, 0, Math.min(3, data.length))
                            + "; type=" + type + "; " + decodeFailure(data));
                }
                items.add(px == null ? item : item.withSize(px[0], px[1]));
            } catch (IOException | RuntimeException e) {
                failed++;
                LOG.debug("evidence image skipped: {}", e.getClass().getSimpleName());
            }
        }
        trace.ok(LookupStep.CAPTURE_IMAGES, (System.nanoTime() - startNanos) / 1_000_000);
        if (items.isEmpty()) {
            trace.fail(LookupStep.CAPTURE_IMAGES, refs.isEmpty() ? StepCause.NO_IMAGES : StepCause.NO_IMAGE_BYTES);
        }
        LookupDiagnostic.note("image-refs=" + refs.size() + "; image-stored=" + items.size() + "; image-no-bytes=" + noBytes
                + "; image-rejected=" + rejected + "; image-failed=" + failed);
        return items;
    }

    /** Numbers about a captured image. Pixel size comes from the bytes themselves when the JDK can read the format. */
    static ImageSize sizeOf(RenderedPageSession.ImageBytes b, String type) {
        ImageSize size = (b.size() == null ? ImageSize.unknown() : b.size()).withBytes(b.data().length);
        int[] px = pixelsOf(b.data());
        return px == null ? size : size.withPixels(px[0], px[1]);
    }

    /** Exception class name only (no message) from a full decode attempt, or "decodes". */
    static String decodeFailure(byte[] data) {
        try {
            return javax.imageio.ImageIO.read(new ByteArrayInputStream(data)) == null ? "no-reader" : "decodes";
        } catch (IOException | RuntimeException e) {
            return "fail-" + e.getClass().getSimpleName();
        }
    }

    /** Width and height from the image header (PNG, JPEG, GIF); null for other formats. Decodes no pixels. */
    static int[] pixelsOf(byte[] data) {
        try (javax.imageio.stream.ImageInputStream in = javax.imageio.ImageIO.createImageInputStream(new ByteArrayInputStream(data))) {
            var readers = javax.imageio.ImageIO.getImageReaders(in);
            if (!readers.hasNext()) {
                return null;
            }
            var reader = readers.next();
            try {
                reader.setInput(in, true, true);
                return new int[] {reader.getWidth(0), reader.getHeight(0)};
            } finally {
                reader.dispose();
            }
        } catch (IOException | RuntimeException e) {
            return null;
        }
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
