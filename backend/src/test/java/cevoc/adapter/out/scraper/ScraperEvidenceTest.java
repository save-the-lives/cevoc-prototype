package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.application.port.out.MediaStoragePort;
import cevoc.domain.EnforcementMethod;
import cevoc.domain.EvidenceItem;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;

/**
 * All tests use saved FICTITIOUS fixtures and a fake session (notice 9000000004, plate TST123, camera code 7109,
 * incident 6). Nothing here touches a browser or the network.
 */
class ScraperEvidenceTest {

    private static final String BASE = "https://penalty.example.invalid/customer_service/finesonline/";
    private static final String PLATE = "TST123";
    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));

    private static ScraperSettings enabled() {
        return new ScraperSettings(BASE, "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), Duration.ofSeconds(60), 1024);
    }

    static class FakeStorage implements MediaStoragePort {
        final List<String> keys = new ArrayList<>();

        @Override
        public void store(String objectKey, String contentType, InputStream content, long contentLength) {
            keys.add(objectKey);
        }

        @Override
        public boolean exists(String objectKey) {
            return keys.contains(objectKey);
        }
    }

    /** Hands out the same fake for every lookup and counts how many sessions were opened. */
    static class Sessions implements RenderedPageSessionFactory {
        final FakeRenderedPageSession session;
        int opened;

        Sessions(FakeRenderedPageSession session) {
            this.session = session;
        }

        @Override
        public RenderedPageSession open(java.net.URI baseUrl) {
            opened++;
            return session;
        }
    }

    private static ScraperEvidenceLookupAdapter adapter(Sessions sessions, FakeStorage storage, RegistrationProvider plates) {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        return new ScraperEvidenceLookupAdapter(enabled(), sessions, new RevenueNswPageParser(), storage, clock, plates);
    }

    @Test
    void withoutARegistrationOnlyNoticeDetailsAreReturnedAndThePlateStepNeverRuns() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        Sessions sessions = new Sessions(fake);
        FakeStorage storage = new FakeStorage();
        ScraperEvidenceLookupAdapter adapter = adapter(sessions, storage, RegistrationProvider.none());

        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.notice().location()).isEqualTo("SAMPLE ROAD, SAMPLETOWN");
        assertThat(r.evidence()).isEmpty();
        assertThat(r.cameraCode()).isNull();
        assertThat(fake.calls).containsExactly("loginPage", "submitLogin");
        assertThat(fake.loginInputs).containsExactly("9000000004|15/01/2026"); // DD/MM/YYYY
        assertThat(fake.closed).isTrue();
        assertThat(storage.keys).isEmpty();

        adapter.find(REQ);
        assertThat(sessions.opened).isEqualTo(1); // second call served from the short cache
    }

    @Test
    void withARegistrationRunsAllThreeStatesBuffersImageBytesFromTheSessionAndReadsCameraCode() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        FakeStorage storage = new FakeStorage();
        ScraperEvidenceLookupAdapter adapter = adapter(new Sessions(fake), storage, req -> Optional.of("tst-123"));

        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.cameraCode()).isEqualTo("7109");
        assertThat(r.notice().enforcementMethod()).isEqualTo(EnforcementMethod.CAMERA);
        // 3 distinct images, one has no bytes in the fake session and is skipped
        assertThat(r.evidence()).extracting(EvidenceItem::kind).containsExactly(EvidenceItem.Kind.IMAGE, EvidenceItem.Kind.IMAGE);
        assertThat(r.evidence()).extracting(EvidenceItem::title).contains("Camera image 700-1-000000001");
        assertThat(storage.keys).hasSize(2).allMatch(k -> k.startsWith("scraped/")
                && !k.contains("9000000004") && !k.toUpperCase().contains("TST123") && !k.contains("700-1"));
        assertThat(fake.calls).containsExactly("loginPage", "submitLogin", "submitPlate", "imageBytes", "imageBytes", "imageBytes");
        // The signed certification deep link answers 403: it is followed only when provider browser-link is listed.
        assertThat(fake.calls).doesNotContain("openCertification");
        assertThat(fake.closed).isTrue();
        assertThat(r.toString()).doesNotContain(PLATE);
    }

    @Test
    void resultsThatUsedARegistrationAreNeverCached() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        Sessions sessions = new Sessions(fake);
        ScraperEvidenceLookupAdapter adapter = adapter(sessions, new FakeStorage(), req -> Optional.of(PLATE));
        adapter.find(REQ);
        adapter.find(REQ);
        assertThat(sessions.opened).isEqualTo(2);
    }

    @Test
    void aRegistrationThatIsNotAcceptedGivesTheNoticeWithoutImages() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        FakeStorage storage = new FakeStorage();
        // fake accepts only TST123; plate form stays on the page for anything else
        ScraperEvidenceLookupAdapter adapter = adapter(new Sessions(fake), storage, req -> Optional.of("TST999"));
        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.summary()).contains("not accepted");
        assertThat(r.evidence()).isEmpty();
        assertThat(r.cameraCode()).isNull();
        assertThat(storage.keys).isEmpty();
        assertThat(r.summary() + r).doesNotContain("TST999");
    }

    @Test
    void implausibleRegistrationSkipsTheImagesStep() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        ScraperEvidenceLookupAdapter adapter = adapter(new Sessions(fake), new FakeStorage(), req -> Optional.of("<script>"));
        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.evidence()).isEmpty();
        assertThat(fake.calls).doesNotContain("submitPlate");
    }

    @Test
    void loginPageAfterSubmitMeansNotFound() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.rejectLogin = true;
        PenaltyLookupResult r = adapter(new Sessions(fake), new FakeStorage(), RegistrationProvider.none()).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.NOT_FOUND);
    }

    @Test
    void noticeTypeNeedingExtraIdentityFieldsIsUnavailableAndNothingIsSubmitted() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.loginHtml = FakeRenderedPageSession.fixture("fictitious-state1-login-needs-name.html");
        PenaltyLookupResult r = adapter(new Sessions(fake), new FakeStorage(), RegistrationProvider.none()).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);
        assertThat(fake.calls).containsExactly("loginPage");
    }

    @Test
    void sessionFailureIsUnavailableAndAWrongNoticeNumberOnThePageIsRejected() {
        FakeRenderedPageSession wrongNumber = new FakeRenderedPageSession();
        wrongNumber.summaryHtml = wrongNumber.summaryHtml.replace("9000000004", "9000000005");
        PenaltyLookupResult r = adapter(new Sessions(wrongNumber), new FakeStorage(), RegistrationProvider.none()).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);

        RenderedPageSessionFactory broken = baseUrl -> {
            throw new IOException("no browser");
        };
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        PenaltyLookupResult r2 = new ScraperEvidenceLookupAdapter(enabled(), broken, new RevenueNswPageParser(), new FakeStorage(), clock).find(REQ);
        assertThat(r2.status()).isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);
    }

    @Test
    void theRegistrationNeverAppearsInCapturedLogOutputOnAnyPath() {
        Logger root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        Level before = root.getLevel();
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        root.setLevel(Level.TRACE);
        root.addAppender(appender);
        PrintStream oldOut = System.out;
        PrintStream oldErr = System.err;
        ByteArrayOutputStream console = new ByteArrayOutputStream();
        PrintStream capture = new PrintStream(console, true);
        System.setOut(capture);
        System.setErr(capture);
        try {
            // accepted, not accepted, and session failure whose exception message contains the plate
            adapter(new Sessions(new FakeRenderedPageSession()), new FakeStorage(), req -> Optional.of(PLATE)).find(REQ);
            adapter(new Sessions(new FakeRenderedPageSession()), new FakeStorage(), req -> Optional.of("TST123X")).find(REQ);
            FakeRenderedPageSession failing = new FakeRenderedPageSession();
            failing.failOnPlate = true;
            PenaltyLookupResult failed = adapter(new Sessions(failing), new FakeStorage(), req -> Optional.of(PLATE)).find(REQ);
            assertThat(failed.status()).isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);
        } finally {
            System.setOut(oldOut);
            System.setErr(oldErr);
            root.detachAppender(appender);
            root.setLevel(before);
        }
        StringBuilder logged = new StringBuilder(console.toString());
        for (ILoggingEvent e : appender.list) {
            logged.append(e.getFormattedMessage()).append(' ').append(e.getLoggerName());
            if (e.getThrowableProxy() != null) {
                logged.append(' ').append(e.getThrowableProxy().getMessage());
            }
        }
        assertThat(appender.list).isNotEmpty(); // the capture really saw our log lines
        assertThat(logged.toString().toUpperCase()).doesNotContain("TST123");
    }

    @Test
    void doesNothingWhenNotConfigured() {
        Sessions sessions = new Sessions(new FakeRenderedPageSession());
        for (ScraperSettings s : List.of(ScraperSettings.off(),
                new ScraperSettings(BASE, "", Duration.ZERO, Duration.ZERO, Duration.ZERO, Duration.ZERO, 1),
                new ScraperSettings("", "c@example.invalid", Duration.ZERO, Duration.ZERO, Duration.ZERO, Duration.ZERO, 1))) {
            PenaltyLookupResult r = new ScraperEvidenceLookupAdapter(s, sessions, new RevenueNswPageParser(),
                    new FakeStorage(), Clock.systemUTC()).find(REQ);
            assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
        }
        assertThat(sessions.opened).isZero();
    }

    @Test
    void rateLimiterWaitsBetweenRequests() {
        long[] now = {0};
        List<Long> sleeps = new ArrayList<>();
        EvidenceRateLimiter limiter = new EvidenceRateLimiter(Duration.ofSeconds(5), () -> now[0], n -> {
            sleeps.add(n);
            now[0] += n;
        });
        limiter.acquire();
        now[0] += Duration.ofSeconds(2).toNanos();
        limiter.acquire();
        assertThat(sleeps).containsExactly(Duration.ofSeconds(3).toNanos());
    }

    @Test
    void userAgentIdentifiesUs() {
        assertThat(enabled().userAgent()).contains("cevoc-prototype/1.0").doesNotContain("NSW").contains("contact:");
    }

    @Test
    void shippedConfigKeepsStubAsDefaultAndHasNoScraperFlags() throws IOException {
        Properties p = new Properties();
        try (InputStream in = Files.newInputStream(Path.of("src/main/resources/application.properties"))) {
            p.load(in);
        }
        assertThat(p.getProperty("cevoc.penalty-lookup.adapter")).isEqualTo("stub");
        for (String retired : new String[] {"cevoc.scraper.enabled", "cevoc.scraper.evidence.enabled", "cevoc.scraper.evidence.browser",
                "cevoc.scraper.certificates.enabled", "cevoc.revenue-nsw-http.enabled", "cevoc.live-check.token"}) {
            assertThat(p.getProperty(retired)).as(retired).isNull();
        }
    }

    /** Fake whose reads after submit-login are scripted: submitLogin returns the first, currentPage the rest (last one repeats). */
    private static FakeRenderedPageSession scripted(String... reads) {
        FakeRenderedPageSession fake = new FakeRenderedPageSession() {
            int next = 1;

            @Override
            public String submitLogin(String noticeNumber, String offenceDate) {
                super.submitLogin(noticeNumber, offenceDate);
                return reads[0];
            }

            @Override
            public Optional<String> currentPage() {
                calls.add("currentPage");
                return Optional.of(reads[Math.min(next++, reads.length - 1)]);
            }
        };
        return fake;
    }

    private static ScraperEvidenceLookupAdapter quick(FakeRenderedPageSession fake) {
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        ScraperEvidenceLookupAdapter a = new ScraperEvidenceLookupAdapter(enabled(), new Sessions(fake), new RevenueNswPageParser(),
                new FakeStorage(), clock);
        a.summaryWait = Duration.ofMillis(600);
        a.loginWait = Duration.ofMillis(200);
        a.pollInterval = Duration.ofMillis(10);
        return a;
    }

    @Test
    void keepsReadingUntilTheSummaryHasRenderedAfterSubmitLogin() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        FakeRenderedPageSession s = scripted("<html><body></body></html>", fake.loginHtml, "<html><body><app-root></app-root></body></html>",
                fake.summaryHtml);
        PenaltyLookupResult r = quick(s).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.notice().location()).isEqualTo("SAMPLE ROAD, SAMPLETOWN");
        assertThat(s.calls).containsExactly("loginPage", "submitLogin", "currentPage", "currentPage", "currentPage");
    }

    @Test
    void anEmptyShellThatNeverRendersEndsAsSummaryTimeoutNotAHang() {
        FakeRenderedPageSession s = scripted("<html><body></body></html>");
        PenaltyLookupResult r = quick(s).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);
        assertThat(s.calls).contains("currentPage");
    }

    @Test
    void aLoginPageThatStaysIsStillNotMatched() {
        FakeRenderedPageSession s = scripted(new FakeRenderedPageSession().loginHtml);
        assertThat(quick(s).find(REQ).status()).isEqualTo(PenaltyLookupResult.Status.NOT_FOUND);
    }

    // ---- plate-required signal, progress callbacks and image sizes ----

    private static class Recorder implements cevoc.application.port.out.LookupProgress {
        final List<String> events = new ArrayList<>();
        PenaltyLookupResult details;
        List<EvidenceItem> evidence;
        boolean plateRequired;

        @Override
        public void details(PenaltyLookupResult partial) {
            events.add("details");
            details = partial;
        }

        @Override
        public void evidence(List<EvidenceItem> items, boolean required) {
            events.add("evidence");
            evidence = items;
            plateRequired = required;
        }
    }

    @Test
    void aCameraNoticeWithoutAPlateSaysThePlateIsRequiredAndNeverEchoesOne() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        Recorder rec = new Recorder();
        PenaltyLookupResult r = adapter(new Sessions(fake), new FakeStorage(), RegistrationProvider.none()).find(REQ, rec);
        assertThat(r.evidence()).isEmpty();
        assertThat(r.plateRequired()).isTrue();
        assertThat(r.notice().enforcementMethod()).isEqualTo(EnforcementMethod.CAMERA);
        assertThat(rec.events).containsExactly("details", "evidence");
        assertThat(rec.details.plateRequired()).isTrue();
        assertThat(rec.details.evidence()).isEmpty();
        assertThat(rec.plateRequired).isTrue();
        assertThat(rec.evidence).isEmpty();
        assertThat(r.toString()).doesNotContain(PLATE);
    }

    @Test
    void withAPlateTheImagesComeBackWithTheirPixelSizeAndNoPlateRequiredFlag() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        Recorder rec = new Recorder();
        PenaltyLookupResult r = adapter(new Sessions(fake), new FakeStorage(), req -> Optional.of(PLATE)).find(REQ, rec);
        assertThat(r.plateRequired()).isFalse();
        assertThat(rec.details.plateRequired()).isFalse();
        assertThat(rec.events).containsExactly("details", "evidence");
        assertThat(rec.plateRequired).isFalse();
        assertThat(rec.evidence).hasSize(2);
        EvidenceItem png = r.evidence().stream().filter(e -> e.width() != null).findFirst().orElseThrow();
        assertThat(png.width()).isEqualTo(8);
        assertThat(png.height()).isEqualTo(6);
    }

    @Test
    void aNotAcceptedPlateIsNotAPlateRequiredAnswer() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        PenaltyLookupResult r = adapter(new Sessions(fake), new FakeStorage(), req -> Optional.of("TST999")).find(REQ);
        assertThat(r.evidence()).isEmpty();
        assertThat(r.plateRequired()).isFalse();
    }

    @Test
    void aCachedNoPlateAnswerStillSaysPlateRequired() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        ScraperEvidenceLookupAdapter adapter = adapter(new Sessions(fake), new FakeStorage(), RegistrationProvider.none());
        adapter.find(REQ);
        assertThat(adapter.find(REQ).plateRequired()).isTrue();
    }

    @Test
    void theSourcesOwnResponseBytesArePreferredAndStoredUntouched() {
        byte[] original = FakeRenderedPageSession.png(40, 30);
        FakeRenderedPageSession fake = new FakeRenderedPageSession() {
            @Override
            public Optional<ImageBytes> originalImage(String ref, String blobUrl) {
                return Optional.of(new ImageBytes("image/jpeg", original, new cevoc.domain.ImageSize(0, 0, 0, 0, 0, 0, 0,
                        cevoc.domain.CapturePath.RESPONSE)));
            }
        };
        List<byte[]> stored = new ArrayList<>();
        List<String> keys = new ArrayList<>();
        MediaStoragePort recording = new MediaStoragePort() {
            @Override
            public void store(String objectKey, String contentType, InputStream content, long contentLength) {
                try {
                    stored.add(content.readAllBytes());
                } catch (IOException e) {
                    throw new IllegalStateException(e);
                }
                keys.add(objectKey);
            }

            @Override
            public boolean exists(String objectKey) {
                return keys.contains(objectKey);
            }
        };
        Clock clock = Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);
        ScraperSettings big = new ScraperSettings(BASE, "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), Duration.ofSeconds(60), 1 << 20);
        var adapter = new ScraperEvidenceLookupAdapter(big, new Sessions(fake), new RevenueNswPageParser(), recording, clock, req -> Optional.of(PLATE));
        PenaltyLookupResult r = adapter.find(REQ);
        assertThat(r.evidence()).hasSize(3); // every frame has its original now, none is skipped for missing bytes
        assertThat(stored).allSatisfy(b -> assertThat(b).isEqualTo(original));
        assertThat(keys).allMatch(k -> k.endsWith(".jpg")); // JPEG stays JPEG: the content type decides, no re-encode
        assertThat(r.evidence()).allSatisfy(e -> assertThat(e.width()).isEqualTo(40));
    }
}
