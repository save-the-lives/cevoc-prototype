package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import cevoc.adapter.out.stub.StubMediaAdapter;
import cevoc.application.port.out.CertificateSourcePort;
import cevoc.application.service.LookupPenaltyService;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import cevoc.domain.EnforcementMethod;
import cevoc.domain.LookupTrace;
import cevoc.domain.NoticeDetails;
import cevoc.domain.NoticeStatus;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.env.MockEnvironment;

/** The certificate lookup path leaves log lines (fixed words and numbers only), so an owner can find a failure in the console logs. */
class CertificateLoggingTest {

    private static final String URL = "https://search.example.invalid/searchCertificates.jsf";
    private static final LocalDate DAY = LocalDate.of(2026, 10, 30);
    private static final String NOTICE_NUMBER = "9000000004";
    private static final String CAMERA = "TEST-LOC-01";
    private static final CertificateQuery Q = CertificateQuery.aroundOffence(CAMERA, DAY, LocalTime.NOON, null);
    private static final NoticeDetails NOTICE = new NoticeDetails("Fictitious offence", DAY, LocalTime.of(11, 12, 13), "SAMPLE ROAD",
            new BigDecimal("100.00"), new BigDecimal("100.00"), NoticeStatus.PAYABLE, "x", EnforcementMethod.CAMERA);

    private final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    private Logger root;
    private Level before;

    @BeforeEach
    void capture() {
        root = (Logger) LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME);
        before = root.getLevel();
        root.setLevel(Level.DEBUG);
        appender.start();
        root.addAppender(appender);
    }

    @AfterEach
    void release() {
        root.detachAppender(appender);
        root.setLevel(before);
        LookupDiagnostic.clear();
        LookupTrace.end();
    }

    private List<String> lines(Level level) {
        return appender.list.stream().filter(e -> e.getLevel() == level).map(ILoggingEvent::getFormattedMessage).toList();
    }

    private List<String> all() {
        return appender.list.stream().map(e -> e.getLevel() + " " + e.getFormattedMessage()).toList();
    }

    private static SearchPageCertificateSource source(ScraperEvidenceTest.Sessions sessions, Instant now) {
        return new SearchPageCertificateSource(sessions, URL, new CertificatePageParser(), Duration.ofMinutes(5), Clock.fixed(now, ZoneOffset.UTC));
    }

    private static PenaltyLookupResult lookup(CertificateSourcePort source, String cameraCode) {
        LookupTrace.begin(false);
        return new LookupPenaltyService(r -> new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, r.infringementNumber(), "x", NOTICE,
                List.of(), "TEST", cameraCode), new StubMediaAdapter("/samples"), source, null)
                .lookup(new PenaltyLookupRequest(NOTICE_NUMBER, DAY));
    }

    @Test
    void serviceLogsOkWithCountAndDuration() {
        lookup(source(new ScraperEvidenceTest.Sessions(new FakeRenderedPageSession()), Instant.parse("2030-01-01T00:00:00Z")), CAMERA);
        assertThat(lines(Level.INFO)).anyMatch(l -> l.matches("Certificates step ok: count=2, duration=\\d+ms"));
    }

    @Test
    void serviceLogsAWarningWithCauseTokenAndDurationOnARefusal() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.searchFailure = "browser step 'certificates' failed: blocked-403";
        lookup(source(new ScraperEvidenceTest.Sessions(fake), Instant.parse("2030-01-01T00:00:00Z")), CAMERA);
        assertThat(lines(Level.WARN)).anyMatch(l -> l.matches("Certificates step failed: cause=blocked-403, duration=\\d+ms"));
        assertThat(lines(Level.WARN)).anyMatch(l -> l.equals("Certificate search page failed: step=certificates; cause=blocked-403"));
    }

    @Test
    void serviceLogsInfoWhenTheSourceIsDisabledOrThereIsNoCameraCode() {
        lookup(null, CAMERA);
        lookup(source(new ScraperEvidenceTest.Sessions(new FakeRenderedPageSession()), Instant.parse("2030-01-01T00:00:00Z")), " ");
        assertThat(lines(Level.INFO)).contains("Certificates step skipped: reason=source-disabled",
                "Certificates step skipped: reason=no-camera-code");
    }

    @Test
    void searchPageLogsCacheMissThenHitAndEvictionAtDebug() {
        ScraperEvidenceTest.Sessions sessions = new ScraperEvidenceTest.Sessions(new FakeRenderedPageSession());
        source(sessions, Instant.parse("2030-01-01T00:00:00Z")).findCertificates(Q);
        SearchPageCertificateSource s = source(sessions, Instant.parse("2030-01-01T00:00:00Z"));
        s.findCertificates(Q);
        s.findCertificates(Q);
        assertThat(lines(Level.INFO)).contains("Certificate search page ok: count=5, cache=miss", "Certificate search page ok: count=5, cache=hit");

        // Evict: one entry past its time, then a different query.
        appender.list.clear();
        java.util.concurrent.atomic.AtomicReference<Instant> now = new java.util.concurrent.atomic.AtomicReference<>(Instant.parse("2030-01-01T00:00:00Z"));
        Clock moving = new Clock() {
            public ZoneOffset getZone() { return ZoneOffset.UTC; }
            public Clock withZone(java.time.ZoneId z) { return this; }
            public Instant instant() { return now.get(); }
        };
        SearchPageCertificateSource m = new SearchPageCertificateSource(sessions, URL, new CertificatePageParser(), Duration.ofMinutes(5), moving);
        m.findCertificates(Q);
        now.set(Instant.parse("2030-01-01T01:00:00Z"));
        m.findCertificates(CertificateQuery.aroundOffence("TEST-LOC-02", DAY, LocalTime.NOON, null));
        assertThat(lines(Level.DEBUG)).contains("Certificate cache evicted: count=1");
    }

    @Test
    void chainLogsSuccessFailureAndRefusal() {
        CertificateSourcePort failing = q -> { throw new ScrapeException("browser step 'certificates' failed: Timeout 45000ms exceeded"); };
        CertificateSourcePort ok = q -> List.of();
        CertificateSourcePort refused = q -> { throw new ScrapeException("blocked-429"); };

        new CertificateProviderChain(List.of("browser", "http"), List.of(failing, ok)).findCertificates(Q);
        assertThat(lines(Level.WARN)).contains("Certificate provider failed: provider=browser, cause=timeout, refusal=false, chain-stopped=false");
        assertThat(lines(Level.INFO)).contains("Certificate provider ok: provider=http, count=0");

        assertThatThrownBy(() -> new CertificateProviderChain(List.of("browser", "http"), List.of(refused, ok)).findCertificates(Q))
                .isInstanceOf(ScrapeException.class);
        assertThat(lines(Level.WARN)).contains("Certificate provider failed: provider=browser, cause=blocked-429, refusal=true, chain-stopped=true");
    }

    @Test
    void startUpLogsTheProvidersAndTheUrl() {
        MockEnvironment env = new MockEnvironment().withProperty("cevoc.certificates.providers", "browser,http")
                .withProperty("cevoc.certificates.search-page.url", URL);
        CertificateProviders.create(env);
        assertThat(lines(Level.INFO)).contains("Certificate source: providers=[browser, http], url=" + URL);
        assertThat(lines(Level.WARN)).anyMatch(l -> l.contains("providers=[browser, http]") && l.contains("url=" + URL));
        appender.list.clear();
        CertificateProviders.create(new MockEnvironment().withProperty("cevoc.certificates.providers", "bogus"));
        assertThat(lines(Level.INFO)).anyMatch(l -> l.startsWith("Certificate source: none configured"));
    }

    @Test
    void noLogLineCarriesTheNoticeNumberCameraCodeOrPageText() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.searchFailure = "browser step 'certificates' failed: blocked-403 for " + NOTICE_NUMBER + " " + CAMERA;
        lookup(source(new ScraperEvidenceTest.Sessions(fake), Instant.parse("2030-01-01T00:00:00Z")), CAMERA);
        lookup(source(new ScraperEvidenceTest.Sessions(new FakeRenderedPageSession()), Instant.parse("2030-01-01T00:00:00Z")), CAMERA);
        assertThat(all()).isNotEmpty().noneMatch(l -> l.contains(NOTICE_NUMBER) || l.contains(CAMERA) || l.contains("TEST split"));
    }
}
