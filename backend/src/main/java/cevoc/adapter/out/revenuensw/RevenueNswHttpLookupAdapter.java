package cevoc.adapter.out.revenuensw;

import cevoc.adapter.out.scraper.EvidenceRateLimiter;
import cevoc.adapter.out.scraper.LookupDiagnostic;
import cevoc.adapter.out.scraper.RegistrationProvider;
import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.MediaStoragePort;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.EvidenceItem;
import cevoc.domain.ImageSize;
import cevoc.domain.CapturePath;
import cevoc.domain.LookupStep;
import cevoc.domain.LookupTrace;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.PenaltyLookupResult.Status;
import cevoc.domain.StepCause;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.LongConsumer;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Plain HTTP route to the Revenue NSW JSON service (adapter kind {@code http}, record 0010): no browser. Off
 * unless selected with {@code cevoc.penalty-lookup.adapter=http} AND configured and given the owner's
 * approval reference. Interim route: replaced by the API providers; the whole package can be deleted.
 *
 * <p>Flow, exactly what the public page does for an anonymous visitor who types the notice number and offence date:
 * a token call (notice number in the {@code pnnum} header, offence date in the JSON body), the summary call, and, only when a
 * registration number was supplied for this request, a second token call carrying it, then one call per image. The newest
 * {@code authorization} value the server returns is always the one sent next. Nothing here bypasses authentication: a 401,
 * 403, 429 or a captcha page stops the lookup with that cause token, with no retry and no workaround. Only a timeout on the
 * summary call is retried (bounded). Every call waits the polite minimum gap and has a timeout.
 *
 * <p>The registration is request-scoped: held in a local variable, sent in the body of the images token call, never
 * logged, cached, put in a key, a trace or the details map. Neither the token nor any response text is logged.
 */
public class RevenueNswHttpLookupAdapter implements PenaltyLookupPort {

    public static final String SOURCE = "REVENUE_NSW_HTTP";
    private static final Logger LOG = LoggerFactory.getLogger(RevenueNswHttpLookupAdapter.class);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern NOTICE_NUMBER = Pattern.compile("[A-Za-z0-9]{4,20}");
    private static final long MAX_JSON_BYTES = 1024 * 1024;
    private static final int MAX_AUTH_LENGTH = 8192;

    private final RevenueNswHttpSettings settings;
    private final HttpTransport transport;
    private final MediaStoragePort storage;
    private final RegistrationProvider registrations;
    private final EvidenceRateLimiter limiter;
    private final LongConsumer sleeperMillis;
    private final DateTimeFormatter dateFormat;

    public RevenueNswHttpLookupAdapter(RevenueNswHttpSettings settings, HttpTransport transport, MediaStoragePort storage,
                                       RegistrationProvider registrations) {
        this(settings, transport, storage, registrations, EvidenceRateLimiter.system(settings.minInterval()), RevenueNswHttpLookupAdapter::sleep);
    }

    RevenueNswHttpLookupAdapter(RevenueNswHttpSettings settings, HttpTransport transport, MediaStoragePort storage,
                                RegistrationProvider registrations, EvidenceRateLimiter limiter, LongConsumer sleeperMillis) {
        this.settings = settings;
        this.transport = transport;
        this.storage = storage;
        this.registrations = registrations;
        this.limiter = limiter;
        this.sleeperMillis = sleeperMillis;
        this.dateFormat = DateTimeFormatter.ofPattern(settings.offenceDateFormat(), Locale.ENGLISH);
    }

    /** A lookup that ended early, with the step, the whitelisted cause and the result to return. */
    private static final class Stop extends Exception {
        final LookupStep step;
        final StepCause cause;
        final Status status;
        final String message;
        final int http;
        long millis;

        Stop(LookupStep step, StepCause cause, Status status, String message, int http) {
            super(cause.token(), null, false, false);
            this.step = step;
            this.cause = cause;
            this.status = status;
            this.message = message;
            this.http = http;
        }
    }

    /** Per-lookup state: the notice number and the newest authorization value. Never logged. */
    private static final class Call {
        final String number;
        String authorization;
        int calls;
        long lastMillis;

        Call(String number) {
            this.number = number;
        }
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        return find(request, LookupProgress.NONE);
    }

    /** synchronized: one lookup at a time, so there are no parallel hits on the service. */
    @Override
    public synchronized PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
        String number = request.infringementNumber();
        if (!settings.usable()) {
            return result(Status.LIVE_LOOKUP_OFF, number, "Looking up this notice is switched off for now, until approvals are in place.");
        }
        if (number == null || !NOTICE_NUMBER.matcher(number).matches() || request.offenceDate() == null) {
            return result(Status.NOT_FOUND, number, "We could not match that notice number and offence date.");
        }
        LookupTrace trace = LookupTrace.current();
        trace.skip(LookupStep.START_BROWSER, StepCause.NOT_SUPPORTED);
        trace.skip(LookupStep.OPEN_LOGIN, StepCause.NOT_SUPPORTED);
        String plate = normalisePlate(registrations.registrationFor(request).orElse(null));
        Call call = new Call(number);
        try {
            return run(call, request, plate, progress);
        } catch (Stop s) {
            trace.ok(s.step, s.millis);
            trace.fail(s.step, s.cause);
            LookupDiagnostic.set("step=" + s.step.label() + "; cause=" + s.cause.token() + "; http=" + (s.http > 0 ? s.http : "none")
                    + "; calls=" + call.calls);
            LOG.warn("revenue-nsw-http lookup ended: step={} cause={}", s.step.label(), s.cause.token());
            return result(s.status, number, s.message);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOG.warn("revenue-nsw-http lookup interrupted");
            return result(Status.UNAVAILABLE, number, "The lookup was interrupted.");
        } catch (IOException | RuntimeException e) {
            // Class name only: a message could echo a header or body value.
            LOG.warn("revenue-nsw-http lookup failed: {}", e.getClass().getSimpleName());
            LookupDiagnostic.set("step=unknown; cause=other; error=" + e.getClass().getSimpleName());
            return result(Status.UNAVAILABLE, number, "The lookup source is not available right now.");
        }
    }

    private PenaltyLookupResult run(Call call, PenaltyLookupRequest request, String plate, LookupProgress progress)
            throws Stop, IOException, InterruptedException {
        long wallStart = System.nanoTime();

        // ---- Call A: token + summary (no plate) → stream details immediately ----
        RevenueNswSummaryMapper.Summary summary = callA(call, request);
        long detailsMs = (System.nanoTime() - wallStart) / 1_000_000;

        LookupTrace trace = LookupTrace.current();
        boolean hasImages = summary.imageCount() > 0 && !summary.imageIds().isEmpty();
        boolean plateRequired = hasImages && plate == null;
        Map<String, Object> details = new LinkedHashMap<>(summary.details());
        String text = "Content from the penalty page.";
        progress.details(new PenaltyLookupResult(Status.FOUND, call.number, text, summary.notice(), List.of(), SOURCE, summary.cameraCode(),
                List.of(), null, plateRequired, details));
        LookupDiagnostic.note("plate-given=" + (plate != null ? "yes" : "no") + "; image-count=" + summary.imageCount()
                + "; image-ids=" + summary.imageIds().size() + "; details-keys=" + details.size());

        // ---- Call B: plate token + image fetches (only when plate is given and images exist) ----
        long photosMs = 0;
        List<EvidenceItem> evidence = List.of();
        if (!hasImages) {
            trace.skip(LookupStep.GIVE_PLATE, StepCause.NO_IMAGES);
            trace.skip(LookupStep.VIEW_IMAGES, StepCause.NO_IMAGES);
            trace.skip(LookupStep.CAPTURE_IMAGES, StepCause.NO_IMAGES);
            progress.evidence(List.of(), false);
        } else if (plate == null) {
            trace.skip(LookupStep.GIVE_PLATE, StepCause.NO_PLATE);
            trace.skip(LookupStep.VIEW_IMAGES, StepCause.NO_PLATE);
            trace.skip(LookupStep.CAPTURE_IMAGES, StepCause.NO_IMAGES);
            progress.evidence(List.of(), plateRequired);
        } else {
            long photosStart = System.nanoTime();
            try {
                evidence = images(call, request, plate, summary, request.offenceDate().format(dateFormat));
                if (evidence.isEmpty()) {
                    text = "Notice details found. The images could not be retrieved.";
                }
            } catch (PlateNotAccepted e) {
                text = "Notice details found. The registration number was not accepted, so no images are shown.";
                trace.fail(LookupStep.VIEW_IMAGES, StepCause.PLATE_NOT_ACCEPTED);
                trace.skip(LookupStep.CAPTURE_IMAGES, StepCause.PRIOR_FAILURE);
            } catch (Stop s) {
                // The notice details are already good: a refusal or fault on the image calls degrades to "no images".
                trace.ok(s.step, s.millis);
                trace.fail(s.step, s.cause);
                LookupDiagnostic.note("step=" + s.step.label() + "; cause=" + s.cause.token() + "; http=" + (s.http > 0 ? s.http : "none"));
                if (!trace.has(LookupStep.CAPTURE_IMAGES)) {
                    trace.skip(LookupStep.CAPTURE_IMAGES, StepCause.PRIOR_FAILURE);
                }
                text = "Notice details found. The source did not release the images, so none are shown.";
            }
            photosMs = (System.nanoTime() - photosStart) / 1_000_000;
            progress.evidence(evidence, false);
        }

        long totalMs = (System.nanoTime() - wallStart) / 1_000_000;
        LOG.info("Lookup timing: details={}ms, photos={}ms, ocr=0ms, certs=0ms, total={}ms", detailsMs, photosMs, totalMs);

        return new PenaltyLookupResult(Status.FOUND, call.number, text, summary.notice(), evidence, SOURCE, summary.cameraCode(),
                List.of(), null, plateRequired, details);
    }

    /**
     * Call A: token (no plate) + summary. Returns the parsed summary and streams details to the caller.
     * When no plate is given, this is the only call made.
     */
    private RevenueNswSummaryMapper.Summary callA(Call call, PenaltyLookupRequest request)
            throws Stop, IOException, InterruptedException {
        LookupTrace trace = LookupTrace.current();
        String offenceDate = request.offenceDate().format(dateFormat);

        // Token call: identify the notice. The token comes back in the body; the server may also rotate it in a header.
        ObjectNode body = JSON.createObjectNode().put("offenceDate", offenceDate);
        HttpTransport.Response tokenResp = exchange(call, LookupStep.SUBMIT_LOGIN, "POST", "/token", body.toString(), MAX_JSON_BYTES);
        if (isNoMatch(tokenResp.status())) {
            trace.ok(LookupStep.SUBMIT_LOGIN, call.lastMillis);
            throw stop(LookupStep.READ_SUMMARY, StepCause.NOT_MATCHED, Status.NOT_FOUND, "We could not match that notice number and offence date.", tokenResp.status(), 0);
        }
        JsonNode tokenJson = json(tokenResp, LookupStep.SUBMIT_LOGIN, call);
        if (tokenJson.path("credentials").path("offenceDate").isBoolean() && !tokenJson.path("credentials").path("offenceDate").asBoolean()) {
            trace.ok(LookupStep.SUBMIT_LOGIN, call.lastMillis);
            throw stop(LookupStep.READ_SUMMARY, StepCause.NOT_MATCHED, Status.NOT_FOUND, "We could not match that notice number and offence date.", tokenResp.status(), 0);
        }
        useToken(call, tokenJson, tokenResp, LookupStep.SUBMIT_LOGIN);
        trace.ok(LookupStep.SUBMIT_LOGIN, call.lastMillis);

        // Summary call. A timeout here is retried a bounded number of times (it hung in some live runs of the browser route).
        HttpTransport.Response sumResp = null;
        long readMillis = 0;
        for (int attempt = 0; sumResp == null; attempt++) {
            if (attempt > 0) {
                sleeperMillis.accept(settings.retryBackoff().toMillis() * attempt);
            }
            try {
                sumResp = exchange(call, LookupStep.READ_SUMMARY, "GET", "", null, MAX_JSON_BYTES);
                readMillis += call.lastMillis;
            } catch (Stop s) {
                readMillis += s.millis;
                if (s.cause != StepCause.TIMEOUT || attempt >= settings.summaryRetries()) {
                    s.millis = readMillis;
                    throw s;
                }
            }
        }
        if (sumResp.status() < 200 || sumResp.status() >= 300) {
            throw stop(LookupStep.READ_SUMMARY, StepCause.SOURCE_FAILED, Status.UNAVAILABLE, "The lookup source is not available right now.", sumResp.status(), readMillis);
        }
        JsonNode sumJson = json(sumResp, LookupStep.READ_SUMMARY, call);
        RevenueNswSummaryMapper.Summary summary;
        try {
            summary = RevenueNswSummaryMapper.map(sumJson);
        } catch (RuntimeException e) {
            throw stop(LookupStep.READ_SUMMARY, StepCause.BAD_SHAPE, Status.UNAVAILABLE, "The lookup source returned something we could not read.", sumResp.status(), readMillis);
        }
        if (summary.noticeNumber() != null && !summary.noticeNumber().equalsIgnoreCase(call.number)) {
            throw stop(LookupStep.READ_SUMMARY, StepCause.NOTICE_MISMATCH, Status.UNAVAILABLE, "The lookup source returned something we could not read.", sumResp.status(), readMillis);
        }
        if (summary.notice().offenceDate() == null && summary.notice().offenceDescription() == null) {
            throw stop(LookupStep.READ_SUMMARY, StepCause.BAD_SHAPE, Status.UNAVAILABLE, "The lookup source returned something we could not read.", sumResp.status(), readMillis);
        }
        trace.ok(LookupStep.READ_SUMMARY, readMillis);
        useRotated(call, sumResp);
        return summary;
    }

    /** The registration was given but the source did not accept it. */
    private static final class PlateNotAccepted extends Exception {
        PlateNotAccepted() {
            super("plate-not-accepted", null, false, false);
        }
    }

    private List<EvidenceItem> images(Call call, PenaltyLookupRequest request, String plate, RevenueNswSummaryMapper.Summary summary,
                                      String offenceDate) throws Stop, PlateNotAccepted, IOException, InterruptedException {
        LookupTrace trace = LookupTrace.current();
        // Second token call: the registration travels in the body of this one call only.
        ObjectNode body = JSON.createObjectNode().put("offenceDate", offenceDate).put("vehicleRego", plate);
        HttpTransport.Response resp = exchange(call, LookupStep.GIVE_PLATE, "POST", "/token", body.toString(), MAX_JSON_BYTES);
        trace.ok(LookupStep.GIVE_PLATE, call.lastMillis);
        if (isNoMatch(resp.status())) {
            throw new PlateNotAccepted();
        }
        JsonNode json = json(resp, LookupStep.GIVE_PLATE, call);
        JsonNode rego = json.path("credentials").path("vehicleRego");
        if (rego.isBoolean() && !rego.asBoolean()) {
            throw new PlateNotAccepted();
        }
        useToken(call, json, resp, LookupStep.GIVE_PLATE);
        trace.ok(LookupStep.VIEW_IMAGES, 0);

        long start = System.nanoTime();
        String key = sha(call.number.toUpperCase(Locale.ROOT) + "|" + request.offenceDate()).substring(0, 16);
        List<EvidenceItem> items = new ArrayList<>();
        int n = 0;
        int failed = 0;
        int rejected = 0;
        Stop refusal = null;
        for (String id : summary.imageIds()) {
            n++;
            try {
                HttpTransport.Response img = exchange(call, LookupStep.CAPTURE_IMAGES, "GET", "/images/" + id + "?size=full", null, settings.maxBytes());
                String type = img.header("content-type") == null ? "" : img.header("content-type").split(";")[0].trim().toLowerCase(Locale.ROOT);
                if (img.status() != 200 || img.body().length == 0 || !type.startsWith("image/")) {
                    rejected++;
                    continue;
                }
                useRotated(call, img);
                String objectKey = "revenue-nsw-http/" + key + "/image-" + n + extension(type);
                storage.store(objectKey, type, new ByteArrayInputStream(img.body()), img.body().length);
                int[] px = pixelsOf(img.body());
                ImageSize size = new ImageSize(px == null ? 0 : px[0], px == null ? 0 : px[1], 0, 0, 0, 0, img.body().length, CapturePath.RESPONSE);
                trace.image(size, type, img.body());
                EvidenceItem item = EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Camera image " + n, objectKey);
                items.add(px == null ? item : item.withSize(px[0], px[1]));
            } catch (Stop s) {
                if (s.cause == StepCause.BLOCKED_401 || s.cause == StepCause.BLOCKED_403 || s.cause == StepCause.BLOCKED_429) {
                    refusal = s;
                    break;
                }
                failed++;
            }
        }
        trace.ok(LookupStep.CAPTURE_IMAGES, (System.nanoTime() - start) / 1_000_000);
        LookupDiagnostic.note("image-ids=" + summary.imageIds().size() + "; image-stored=" + items.size() + "; image-rejected=" + rejected
                + "; image-failed=" + failed);
        if (refusal != null) {
            trace.fail(LookupStep.CAPTURE_IMAGES, refusal.cause);
        } else if (items.isEmpty()) {
            trace.fail(LookupStep.CAPTURE_IMAGES, StepCause.NO_IMAGE_BYTES);
        }
        return items;
    }

    // ---- transport helpers ----

    /**
     * One call: waits the polite gap, sends the identifying headers and the newest authorization, records no values. Any answer
     * is returned to the caller except a refusal (401, 403, 429), a server fault (5xx), a timeout or a network error, which stop the
     * lookup with a whitelisted cause. {@code path} is appended to the fines root.
     */
    private HttpTransport.Response exchange(Call call, LookupStep step, String method, String path, String body, long maxBytes)
            throws Stop, InterruptedException {
        String root = settings.finesRoot();
        URI uri = URI.create(root + path);
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("accept", path.startsWith("/images/") ? "image/jpeg, image/*;q=0.8" : "application/json");
        headers.put("user-agent", settings.userAgent());
        headers.put("pnnum", call.number);
        if (body != null) {
            headers.put("content-type", "application/json");
        }
        if (call.authorization != null) {
            headers.put("authorization", call.authorization);
        }
        limiter.acquire();
        call.calls++;
        long start = System.nanoTime();
        HttpTransport.Response resp;
        try {
            resp = transport.send(new HttpTransport.Request(method, uri, headers, body), maxBytes, settings.requestTimeout());
        } catch (HttpTransport.TimeoutException e) {
            throw withMillis(stop(step, StepCause.TIMEOUT, Status.UNAVAILABLE, "The lookup source is not available right now.", 0, 0), start);
        } catch (HttpTransport.TooLargeException e) {
            throw withMillis(stop(step, StepCause.SOURCE_FAILED, Status.UNAVAILABLE, "The lookup source returned something we could not read.", 0, 0), start);
        } catch (IOException e) {
            throw withMillis(stop(step, StepCause.NETWORK_ERROR, Status.UNAVAILABLE, "The lookup source is not available right now.", 0, 0), start);
        }
        call.lastMillis = (System.nanoTime() - start) / 1_000_000;
        StepCause blocked = switch (resp.status()) {
            case 401 -> StepCause.BLOCKED_401;
            case 403 -> StepCause.BLOCKED_403;
            case 429 -> StepCause.BLOCKED_429;
            default -> null;
        };
        if (blocked != null) {
            boolean captcha = looksLikeCaptcha(resp);
            throw withMillis(stop(step, captcha ? StepCause.CAPTCHA : blocked, Status.UNAVAILABLE, "The lookup source refused the request.", resp.status(), 0), start);
        }
        if (resp.status() >= 500) {
            throw withMillis(stop(step, StepCause.SOURCE_FAILED, Status.UNAVAILABLE, "The lookup source is not available right now.", resp.status(), 0), start);
        }
        return resp;
    }

    private static Stop withMillis(Stop s, long startNanos) {
        s.millis = (System.nanoTime() - startNanos) / 1_000_000;
        return s;
    }

    private static Stop stop(LookupStep step, StepCause cause, Status status, String message, int http, long millis) {
        Stop s = new Stop(step, cause, status, message, http);
        s.millis = millis;
        return s;
    }

    private static boolean isNoMatch(int status) {
        return status == 400 || status == 404 || status == 422;
    }

    private static boolean looksLikeCaptcha(HttpTransport.Response r) {
        String type = r.header("content-type");
        if (type == null || !type.toLowerCase(Locale.ROOT).contains("html")) {
            return false;
        }
        int n = Math.min(r.body().length, 64 * 1024);
        return new String(r.body(), 0, n, StandardCharsets.UTF_8).toLowerCase(Locale.ROOT).contains("captcha");
    }

    /** A JSON object body, or a stop with a whitelisted cause: captcha for a challenge page, bad-shape for anything else. */
    private JsonNode json(HttpTransport.Response r, LookupStep step, Call call) throws Stop {
        if (r.status() < 200 || r.status() >= 300) {
            throw stop(step, StepCause.SOURCE_FAILED, Status.UNAVAILABLE, "The lookup source is not available right now.", r.status(), call.lastMillis);
        }
        if (looksLikeCaptcha(r)) {
            throw stop(step, StepCause.CAPTCHA, Status.UNAVAILABLE, "The lookup source refused the request.", r.status(), call.lastMillis);
        }
        try {
            JsonNode n = JSON.readTree(r.body());
            if (n != null && n.isObject()) {
                return n;
            }
        } catch (IOException e) {
            // fall through: bad shape
        }
        throw stop(step, StepCause.BAD_SHAPE, Status.UNAVAILABLE, "The lookup source returned something we could not read.", r.status(), call.lastMillis);
    }

    /** The token in the body, set as the authorization value (with the configured scheme if any), unless the server rotated it in a header. */
    private void useToken(Call call, JsonNode json, HttpTransport.Response resp, LookupStep step) throws Stop {
        JsonNode t = json.path("token");
        String token = t.isTextual() ? t.asText().trim() : "";
        if (token.isEmpty() || token.length() > MAX_AUTH_LENGTH || token.chars().anyMatch(c -> c < 33 || c > 126)) {
            throw stop(step, StepCause.BAD_SHAPE, Status.UNAVAILABLE, "The lookup source returned something we could not read.", resp.status(), call.lastMillis);
        }
        call.authorization = settings.authorizationScheme().isEmpty() ? token : settings.authorizationScheme() + " " + token;
        useRotated(call, resp);
    }

    /** Always send the newest authorization value the server returns (record 0010). */
    private static void useRotated(Call call, HttpTransport.Response resp) {
        String rotated = resp.header("authorization");
        if (rotated != null && !rotated.isBlank() && rotated.length() <= MAX_AUTH_LENGTH && rotated.chars().allMatch(c -> c >= 32 && c <= 126)) {
            call.authorization = rotated.trim();
        }
    }

    // ---- small pure helpers ----

    private static PenaltyLookupResult result(Status status, String number, String summary) {
        return new PenaltyLookupResult(status, number, summary, null, List.of(), SOURCE);
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while waiting to retry", e);
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

    private static String extension(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            case "image/gif" -> ".gif";
            case "image/webp" -> ".webp";
            default -> ".bin";
        };
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

    private static String sha(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
