package cevoc.adapter.out.revenuensw;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.scraper.EvidenceRateLimiter;
import cevoc.adapter.out.scraper.LookupDiagnostic;
import cevoc.adapter.out.scraper.RegistrationProvider;
import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.MediaStoragePort;
import cevoc.domain.EnforcementMethod;
import cevoc.domain.EvidenceItem;
import cevoc.domain.LookupStep;
import cevoc.domain.LookupTrace;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.PenaltyLookupResult.Status;
import cevoc.domain.StepCause;
import cevoc.domain.StepOutcome;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

/**
 * The plain HTTP route against a scripted fake transport and invented recorded-shape fixtures (notice 9000000004,
 * plate TST123, camera 7109). No live call is ever made.
 */
class RevenueNswHttpLookupAdapterTest {

    private static final String NOTICE = "9000000004";
    private static final String PLATE = "TST123";
    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest(NOTICE, LocalDate.of(2026, 1, 15));

    static class FakeStorage implements MediaStoragePort {
        final List<String> keys = new ArrayList<>();
        final List<Integer> sizes = new ArrayList<>();

        @Override
        public void store(String objectKey, String contentType, InputStream content, long contentLength) {
            keys.add(objectKey);
            sizes.add((int) contentLength);
        }

        @Override
        public boolean exists(String objectKey) {
            return keys.contains(objectKey);
        }
    }

    private FakeStorage storage;
    private final List<Long> sleeps = new ArrayList<>();
    private ListAppender<ILoggingEvent> logs;

    @BeforeEach
    void begin() {
        storage = new FakeStorage();
        LookupTrace.begin(false);
        logs = new ListAppender<>();
        logs.start();
        Logger root = (Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME);
        root.setLevel(Level.ALL);
        root.addAppender(logs);
    }

    @AfterEach
    void end() {
        LookupTrace.end();
        ((Logger) LoggerFactory.getLogger(org.slf4j.Logger.ROOT_LOGGER_NAME)).detachAppender(logs);
    }

    static RevenueNswHttpSettings settings(int retries, String scheme) {
        return new RevenueNswHttpSettings("https://api.osr.nsw.gov.au", "TEST_PREFIX_AAAA", "test-contact@example.invalid",
                "test-approval-reference", scheme, "yyyy-MM-dd", Duration.ZERO, Duration.ofSeconds(1), Duration.ofSeconds(1),
                1024 * 1024, retries, Duration.ZERO, Set.of("api.osr.nsw.gov.au"));
    }

    private RevenueNswHttpLookupAdapter adapter(FakeTransport t, RegistrationProvider plates) {
        return adapter(settings(1, ""), t, plates);
    }

    private RevenueNswHttpLookupAdapter adapter(RevenueNswHttpSettings s, FakeTransport t, RegistrationProvider plates) {
        return new RevenueNswHttpLookupAdapter(s, t, storage, plates,
                new EvidenceRateLimiter(Duration.ZERO, System::nanoTime, n -> { }), sleeps::add);
    }

    private static RegistrationProvider plate() {
        return r -> Optional.of(" tst-123 ");
    }

    static byte[] jpeg(int w, int h) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            javax.imageio.ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "jpg", out);
            return out.toByteArray();
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** The happy service: token, summary, images. Each test wraps or replaces parts of it. */
    private static FakeTransport.Handler happy(String summaryFixture) {
        return r -> {
            String u = r.uri().toString();
            if (r.method().equals("POST") && u.endsWith("/token")) {
                return FakeTransport.json(200, FakeTransport.resource(r.body().contains("vehicleRego") ? "token-images.json" : "token.json"));
            }
            if (u.contains("/images/")) {
                return FakeTransport.image(jpeg(8, 6));
            }
            return FakeTransport.json(200, FakeTransport.resource(summaryFixture));
        };
    }

    private static StepOutcome outcome(LookupStep s) {
        return LookupTrace.current().entries().stream().filter(e -> e.step() == s).findFirst().orElseThrow().outcome();
    }

    private static StepCause cause(LookupStep s) {
        return LookupTrace.current().entries().stream().filter(e -> e.step() == s).findFirst().orElseThrow().cause();
    }

    // ---- found ----

    @Test
    void foundWithImagesWhenTheRegistrationIsGiven() {
        FakeTransport t = new FakeTransport(happy("summary-camera.json"));
        PenaltyLookupResult r = adapter(t, plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(r.source()).isEqualTo("REVENUE_NSW_HTTP");
        assertThat(r.notice().offenceDescription()).isEqualTo("Fictitious offence description");
        assertThat(r.notice().enforcementMethod()).isEqualTo(EnforcementMethod.CAMERA);
        assertThat(r.cameraCode()).isEqualTo("7109");
        assertThat(r.plateRequired()).isFalse();
        assertThat(r.evidence()).hasSize(2);
        EvidenceItem first = r.evidence().get(0);
        assertThat(first.kind()).isEqualTo(EvidenceItem.Kind.IMAGE);
        assertThat(first.url()).startsWith("revenue-nsw-http/").endsWith("image-1.jpg");
        assertThat(first.width()).isEqualTo(8);
        assertThat(first.height()).isEqualTo(6);
        assertThat(storage.keys).hasSize(2);
        assertThat(r.details()).containsEntry("demeritPoints", 3).containsKey("imageCount");
        assertThat(t.count("POST", "/token")).isEqualTo(2);
        assertThat(t.count("GET", "/images/fict-img-1?size=full")).isEqualTo(1);
    }

    @Test
    void traceUsesTheSharedVocabularyAndMarksBrowserStepsNotSupported() {
        adapter(new FakeTransport(happy("summary-camera.json")), plate()).find(REQ);
        assertThat(cause(LookupStep.START_BROWSER)).isEqualTo(StepCause.NOT_SUPPORTED);
        assertThat(cause(LookupStep.OPEN_LOGIN)).isEqualTo(StepCause.NOT_SUPPORTED);
        for (LookupStep s : new LookupStep[] {LookupStep.SUBMIT_LOGIN, LookupStep.READ_SUMMARY, LookupStep.GIVE_PLATE,
                LookupStep.VIEW_IMAGES, LookupStep.CAPTURE_IMAGES}) {
            assertThat(outcome(s)).as(s.label()).isEqualTo(StepOutcome.OK);
        }
        assertThat(LookupTrace.current().firstFailed()).isNull();
        assertThat(LookupTrace.current().images()).hasSize(2);
        assertThat(LookupTrace.current().images().get(0).path()).isEqualTo(cevoc.domain.CapturePath.RESPONSE);
    }

    @Test
    void foundWithoutPlateKeepsTheImagesBackAndMakesNoImageCalls() {
        FakeTransport t = new FakeTransport(happy("summary-camera.json"));
        PenaltyLookupResult r = adapter(t, RegistrationProvider.none()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(r.plateRequired()).isTrue();
        assertThat(r.evidence()).isEmpty();
        assertThat(r.notice()).isNotNull();
        assertThat(t.count("POST", "/token")).isEqualTo(1);
        assertThat(t.seen.stream().noneMatch(s -> s.uri().contains("/images/"))).isTrue();
        assertThat(cause(LookupStep.GIVE_PLATE)).isEqualTo(StepCause.NO_PLATE);
        assertThat(LookupTrace.current().firstFailed()).isNull();
    }

    @Test
    void officerIssuedNoticeHasNoImagesByDesignAndNoPlateRequirement() {
        FakeTransport t = new FakeTransport(happy("summary-officer.json"));
        PenaltyLookupResult r = adapter(t, plate()).find(new PenaltyLookupRequest("9000000005", LocalDate.of(2026, 1, 15)));
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(r.plateRequired()).isFalse();
        assertThat(r.evidence()).isEmpty();
        assertThat(cause(LookupStep.CAPTURE_IMAGES)).isEqualTo(StepCause.NO_IMAGES);
        assertThat(LookupTrace.current().firstFailed()).isNull();
        assertThat(t.count("POST", "/token")).isEqualTo(1);
    }

    @Test
    void progressSeesTheDetailsBeforeTheImages() {
        List<String> events = new ArrayList<>();
        adapter(new FakeTransport(happy("summary-camera.json")), plate()).find(REQ, new LookupProgress() {
            @Override
            public void details(PenaltyLookupResult partial) {
                events.add("details:" + partial.evidence().size());
            }

            @Override
            public void evidence(List<EvidenceItem> items, boolean plateRequired) {
                events.add("evidence:" + items.size());
            }
        });
        assertThat(events).containsExactly("details:0", "evidence:2");
    }

    // ---- not found and wrong plate (by design) ----

    @Test
    void noMatchByHttpStatusIsNotFoundAndNotATechnicalFailure() {
        FakeTransport t = new FakeTransport(r -> FakeTransport.json(404, "{}"));
        PenaltyLookupResult r = adapter(t, plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.NOT_FOUND);
        assertThat(cause(LookupStep.READ_SUMMARY)).isEqualTo(StepCause.NOT_MATCHED);
        assertThat(t.seen).hasSize(1);
    }

    @Test
    void noMatchByCredentialsFlagIsNotFound() {
        FakeTransport t = new FakeTransport(r -> FakeTransport.json(200, FakeTransport.resource("token-wrong-date.json")));
        assertThat(adapter(t, plate()).find(REQ).status()).isEqualTo(Status.NOT_FOUND);
        assertThat(t.seen).hasSize(1);
    }

    @Test
    void wrongRegistrationByCredentialsFlagKeepsTheNoticeAndSaysNotAccepted() {
        FakeTransport.Handler h = r -> r.method().equals("POST") && r.body().contains("vehicleRego")
                ? FakeTransport.json(200, FakeTransport.resource("token-wrong-rego.json")) : happy("summary-camera.json").answer(r);
        PenaltyLookupResult r = adapter(new FakeTransport(h), plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(r.notice()).isNotNull();
        assertThat(r.evidence()).isEmpty();
        assertThat(r.summary()).contains("not accepted");
        assertThat(cause(LookupStep.VIEW_IMAGES)).isEqualTo(StepCause.PLATE_NOT_ACCEPTED);
    }

    @Test
    void wrongRegistrationByHttpStatusIsAlsoNotAccepted() {
        FakeTransport.Handler h = r -> r.method().equals("POST") && r.body().contains("vehicleRego")
                ? FakeTransport.json(422, "{}") : happy("summary-camera.json").answer(r);
        PenaltyLookupResult r = adapter(new FakeTransport(h), plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(cause(LookupStep.VIEW_IMAGES)).isEqualTo(StepCause.PLATE_NOT_ACCEPTED);
    }

    // ---- refusals stop with no retry ----

    @Test
    void refusalsStopTheLookupWithTheirCauseAndAreNeverRetried() {
        int[][] cases = {{401}, {403}, {429}};
        StepCause[] expect = {StepCause.BLOCKED_401, StepCause.BLOCKED_403, StepCause.BLOCKED_429};
        for (int i = 0; i < cases.length; i++) {
            LookupTrace.end();
            LookupTrace.begin(false);
            int status = cases[i][0];
            FakeTransport t = new FakeTransport(r -> r.uri().toString().endsWith("/token")
                    ? FakeTransport.json(200, FakeTransport.resource("token.json")) : FakeTransport.json(status, "{}"));
            PenaltyLookupResult r = adapter(t, plate()).find(REQ);
            assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
            assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(expect[i]);
            assertThat(LookupTrace.current().firstFailed().step()).isEqualTo(LookupStep.READ_SUMMARY);
            assertThat(t.seen).hasSize(2);
            assertThat(sleeps).isEmpty();
        }
    }

    @Test
    void refusalOnTheTokenCallStopsAtOnce() {
        FakeTransport t = new FakeTransport(r -> FakeTransport.json(403, "{}"));
        PenaltyLookupResult r = adapter(t, plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(LookupTrace.current().firstFailed().step()).isEqualTo(LookupStep.SUBMIT_LOGIN);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.BLOCKED_403);
        assertThat(t.seen).hasSize(1);
    }

    @Test
    void aRefusalOnAnImageStopsTheImageLoopAndKeepsWhatWasCaptured() {
        FakeTransport.Handler h = r -> r.uri().toString().contains("fict-img-2") ? FakeTransport.json(429, "{}") : happy("summary-camera.json").answer(r);
        FakeTransport t = new FakeTransport(h);
        PenaltyLookupResult r = adapter(t, plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(r.evidence()).hasSize(1);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.BLOCKED_429);
        assertThat(t.count("GET", "/images/fict-img-2?size=full")).isEqualTo(1);
    }

    @Test
    void aChallengePageIsReportedAsCaptchaNotParsed() {
        byte[] html = "<html><body>Please complete the CAPTCHA</body></html>".getBytes(java.nio.charset.StandardCharsets.UTF_8);
        FakeTransport t = new FakeTransport(r -> new HttpTransport.Response(403, Map.of("content-type", "text/html"), html));
        adapter(t, plate()).find(REQ);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.CAPTCHA);
        FakeTransport t2 = new FakeTransport(r -> new HttpTransport.Response(200, Map.of("content-type", "text/html"), html));
        LookupTrace.end();
        LookupTrace.begin(false);
        adapter(t2, plate()).find(REQ);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.CAPTCHA);
    }

    // ---- technical failures ----

    @Test
    void summaryTimeoutIsRetriedOnceThenSucceeds() {
        int[] summaryCalls = {0};
        FakeTransport.Handler h = r -> {
            if (!r.uri().toString().endsWith("/token") && !r.uri().toString().contains("/images/") && summaryCalls[0]++ == 0) {
                throw new HttpTransport.TimeoutException();
            }
            return happy("summary-camera.json").answer(r);
        };
        FakeTransport t = new FakeTransport(h);
        PenaltyLookupResult r = adapter(t, RegistrationProvider.none()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(summaryCalls[0]).isEqualTo(2);
        assertThat(sleeps).hasSize(1);
    }

    @Test
    void summaryTimeoutRetriesAreBounded() {
        FakeTransport.Handler h = r -> {
            if (r.uri().toString().endsWith("/token")) {
                return FakeTransport.json(200, FakeTransport.resource("token.json"));
            }
            throw new HttpTransport.TimeoutException();
        };
        FakeTransport t = new FakeTransport(h);
        PenaltyLookupResult r = adapter(settings(2, ""), t, RegistrationProvider.none()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(t.seen).hasSize(1 + 3);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.TIMEOUT);
        // Settings clamp a larger request to the limit in record 0010.
        assertThat(settings(9, "").summaryRetries()).isEqualTo(2);
    }

    @Test
    void aTimeoutOnTheTokenCallIsNotRetried() {
        FakeTransport t = new FakeTransport(r -> {
            throw new HttpTransport.TimeoutException();
        });
        PenaltyLookupResult r = adapter(t, plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(t.seen).hasSize(1);
        assertThat(LookupTrace.current().firstFailed().step()).isEqualTo(LookupStep.SUBMIT_LOGIN);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.TIMEOUT);
    }

    @Test
    void serverFaultAndNetworkErrorAreTechnicalFailuresNotNotFound() {
        FakeTransport t = new FakeTransport(r -> FakeTransport.json(503, "{}"));
        assertThat(adapter(t, plate()).find(REQ).status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.SOURCE_FAILED);
        LookupTrace.end();
        LookupTrace.begin(false);
        FakeTransport t2 = new FakeTransport(r -> {
            throw new java.io.IOException("connection reset by peer 9000000004");
        });
        PenaltyLookupResult r = adapter(t2, plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.NETWORK_ERROR);
    }

    @Test
    void unreadableOrMismatchedBodiesAreBadShapeOrMismatch() {
        FakeTransport bad = new FakeTransport(r -> r.uri().toString().endsWith("/token")
                ? FakeTransport.json(200, FakeTransport.resource("token.json")) : FakeTransport.json(200, "[1,2,3]"));
        assertThat(adapter(bad, plate()).find(REQ).status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.BAD_SHAPE);

        LookupTrace.end();
        LookupTrace.begin(false);
        FakeTransport noToken = new FakeTransport(r -> FakeTransport.json(200, "{\"credentials\":{\"offenceDate\":true}}"));
        assertThat(adapter(noToken, plate()).find(REQ).status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(LookupTrace.current().firstFailed().step()).isEqualTo(LookupStep.SUBMIT_LOGIN);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.BAD_SHAPE);

        LookupTrace.end();
        LookupTrace.begin(false);
        FakeTransport other = new FakeTransport(happy("summary-officer.json"));
        assertThat(adapter(other, plate()).find(REQ).status()).isEqualTo(Status.UNAVAILABLE);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.NOTICE_MISMATCH);
    }

    @Test
    void nonImageAnswersAreRejectedAndNoImagesIsAFailureOfTheCaptureStepOnly() {
        FakeTransport.Handler h = r -> r.uri().toString().contains("/images/") ? FakeTransport.json(200, "{}") : happy("summary-camera.json").answer(r);
        PenaltyLookupResult r = adapter(new FakeTransport(h), plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.FOUND);
        assertThat(r.evidence()).isEmpty();
        assertThat(storage.keys).isEmpty();
        assertThat(LookupTrace.current().firstFailed().step()).isEqualTo(LookupStep.CAPTURE_IMAGES);
        assertThat(LookupTrace.current().firstFailed().cause()).isEqualTo(StepCause.NO_IMAGE_BYTES);
    }

    // ---- request rules ----

    @Test
    void theNewestAuthorizationIsAlwaysSentAndTheSchemeIsConfigurable() {
        FakeTransport.Handler h = r -> {
            String u = r.uri().toString();
            if (u.endsWith("/token") && !r.body().contains("vehicleRego")) {
                return FakeTransport.json(200, FakeTransport.resource("token.json"));
            }
            if (u.endsWith("/token")) {
                return FakeTransport.json(200, FakeTransport.resource("token-images.json"), Map.of("authorization", "rotated-two"));
            }
            if (u.contains("fict-img-1")) {
                return new HttpTransport.Response(200, Map.of("content-type", "image/jpeg", "authorization", "rotated-three"), jpeg(4, 4));
            }
            if (u.contains("/images/")) {
                return FakeTransport.image(jpeg(4, 4));
            }
            return FakeTransport.json(200, FakeTransport.resource("summary-camera.json"), Map.of("authorization", "rotated-one"));
        };
        FakeTransport t = new FakeTransport(h);
        adapter(settings(1, "Custom"), t, plate()).find(REQ);
        assertThat(t.seen.get(0).headers()).doesNotContainKey("authorization");
        assertThat(t.seen.get(1).headers()).containsEntry("authorization", "Custom fictitious.token.one");
        assertThat(t.seen.get(2).headers()).containsEntry("authorization", "rotated-one");
        assertThat(t.seen.get(3).headers()).containsEntry("authorization", "rotated-two");
        assertThat(t.seen.get(4).headers()).containsEntry("authorization", "rotated-three");
    }

    @Test
    void requestsIdentifyUsHonestlyAndCarryNoBrowserDisguise() {
        FakeTransport t = new FakeTransport(happy("summary-camera.json"));
        adapter(t, plate()).find(REQ);
        for (FakeTransport.Seen s : t.seen) {
            assertThat(s.headers().get("user-agent")).startsWith("cevoc-prototype/1.0 (contact: test-contact@example.invalid)");
            assertThat(s.headers()).containsEntry("pnnum", NOTICE).doesNotContainKeys("origin", "referer", "cookie");
            assertThat(s.uri()).startsWith("https://api.osr.nsw.gov.au/TEST_PREFIX_AAAA/rest/api/v2/fines");
        }
        assertThat(t.seen.get(0).method()).isEqualTo("POST");
        assertThat(t.seen.get(0).body()).isEqualTo("{\"offenceDate\":\"2026-01-15\"}");
        assertThat(t.seen.get(2).body()).contains("\"vehicleRego\":\"TST123\"");
    }

    @Test
    void theRegistrationGoesOnlyInTheBodyOfTheImagesTokenCall() {
        FakeTransport t = new FakeTransport(happy("summary-camera.json"));
        adapter(t, plate()).find(REQ);
        long withPlate = t.seen.stream().filter(s -> s.body() != null && s.body().contains("TST123")).count();
        assertThat(withPlate).isEqualTo(1);
        assertThat(t.seen.stream().map(FakeTransport.Seen::uri).filter(u -> u.contains("TST123"))).isEmpty();
        assertThat(t.seen.stream().flatMap(s -> s.headers().values().stream()).filter(v -> v.contains("TST123"))).isEmpty();
    }

    @Test
    void nothingSensitiveReachesTheLogsTheTraceTheDiagnosticOrTheDetails() {
        LookupDiagnostic.clear();
        FakeTransport t = new FakeTransport(r -> r.uri().toString().contains("/images/") ? FakeTransport.json(403, "{\"token\":\"fictitious.token.two\"}")
                : happy("summary-camera.json").answer(r));
        PenaltyLookupResult r = adapter(t, plate()).find(REQ);
        String diag = String.valueOf(LookupDiagnostic.take());
        String trace = LookupTrace.current().entries().toString();
        String logged = logs.list.stream().map(ILoggingEvent::getFormattedMessage).reduce("", (a, b) -> a + b);
        for (String secret : new String[] {PLATE, "TST-123", NOTICE, "fictitious.token", "SIGNEDFICTITIOUS", "fict-img"}) {
            assertThat(diag).as("diag").doesNotContain(secret);
            assertThat(trace).as("trace").doesNotContain(secret);
            assertThat(logged).as("logs").doesNotContain(secret);
            assertThat(r.details().toString()).as("details").doesNotContain(secret);
        }
    }

    // ---- off by default ----

    @Test
    void offMeansNoCallAtAll() {
        FakeTransport t = new FakeTransport(happy("summary-camera.json"));
        PenaltyLookupResult r = adapter(RevenueNswHttpSettings.off(), t, plate()).find(REQ);
        assertThat(r.status()).isEqualTo(Status.LIVE_LOOKUP_OFF);
        assertThat(t.seen).isEmpty();
    }

    @Test
    void anImplausibleNoticeNumberIsNotFoundWithoutACall() {
        FakeTransport t = new FakeTransport(happy("summary-camera.json"));
        PenaltyLookupResult r = adapter(t, plate()).find(new PenaltyLookupRequest("ZZ ZZ", LocalDate.of(2026, 1, 15)));
        assertThat(r.status()).isEqualTo(Status.NOT_FOUND);
        assertThat(t.seen).isEmpty();
    }
}
