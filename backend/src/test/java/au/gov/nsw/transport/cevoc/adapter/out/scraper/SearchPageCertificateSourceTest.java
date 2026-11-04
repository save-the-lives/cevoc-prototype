package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import au.gov.nsw.transport.cevoc.adapter.out.stub.StubMediaAdapter;
import au.gov.nsw.transport.cevoc.application.service.LookupPenaltyService;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.LookupStep;
import au.gov.nsw.transport.cevoc.domain.LookupTrace;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import au.gov.nsw.transport.cevoc.domain.StepCause;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The search-page provider with a fake browser session and FICTITIOUS pages: no network, no browser. */
class SearchPageCertificateSourceTest {

    private static final String URL = "https://search.example.invalid/searchCertificates.jsf";
    private static final LocalDate DAY = LocalDate.of(2026, 10, 30);
    private static final CertificateQuery Q = CertificateQuery.aroundOffence("TEST-LOC-01", DAY, LocalTime.NOON, null);

    @AfterEach
    void cleanUp() {
        LookupDiagnostic.clear();
        LookupTrace.end();
    }

    private static SearchPageCertificateSource source(ScraperEvidenceTest.Sessions sessions) {
        return new SearchPageCertificateSource(sessions, URL, new CertificatePageParser(), Duration.ofMinutes(5),
                Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC));
    }

    @Test
    void passesTheCameraCodeAndTheWholeOffenceDayToTheSearchAndClosesTheSession() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        List<CertificateRef> rows = source(new ScraperEvidenceTest.Sessions(fake)).findCertificates(Q);
        assertThat(rows).hasSize(5);
        assertThat(fake.searches).containsExactly(URL + "|TEST-LOC-01|2026-10-30T00:00|2026-10-30T23:59");
        assertThat(fake.closed).isTrue();
        assertThat(LookupDiagnostic.take()).contains("step=certificates-parse; outcome=ok; rows=5");
    }

    @Test
    void resultsAreCachedBrieflyAndFailuresAreNot() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        ScraperEvidenceTest.Sessions sessions = new ScraperEvidenceTest.Sessions(fake);
        SearchPageCertificateSource s = source(sessions);
        s.findCertificates(Q);
        s.findCertificates(Q);
        assertThat(sessions.opened).isEqualTo(1);

        FakeRenderedPageSession failing = new FakeRenderedPageSession();
        failing.searchFailure = "browser step 'certificates' failed: Timeout 45000ms exceeded";
        ScraperEvidenceTest.Sessions sessions2 = new ScraperEvidenceTest.Sessions(failing);
        SearchPageCertificateSource s2 = source(sessions2);
        assertThatThrownBy(() -> s2.findCertificates(Q)).isInstanceOf(ScrapeException.class);
        assertThatThrownBy(() -> s2.findCertificates(Q)).isInstanceOf(ScrapeException.class);
        assertThat(sessions2.opened).isEqualTo(2);
    }

    @Test
    void aRefusalIsReportedAsBlockedAndNeverRetried() {
        for (int status : new int[] {401, 403, 429}) {
            FakeRenderedPageSession fake = new FakeRenderedPageSession();
            fake.searchFailure = "browser step 'certificates' failed: blocked-" + status;
            ScraperEvidenceTest.Sessions sessions = new ScraperEvidenceTest.Sessions(fake);
            assertThatThrownBy(() -> source(sessions).findCertificates(Q)).isInstanceOf(ScrapeException.class)
                    .hasMessageContaining("blocked-" + status);
            assertThat(sessions.opened).as("one attempt only").isEqualTo(1);
            assertThat(fake.searches).hasSize(1);
            assertThat(LookupDiagnostic.take()).contains("step=certificates; outcome=failed; cause=blocked-" + status);
        }
    }

    @Test
    void aSessionThatCannotSearchIsReportedNotSilentlyEmpty() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.searchHtml = null;
        assertThatThrownBy(() -> source(new ScraperEvidenceTest.Sessions(fake)).findCertificates(Q)).isInstanceOf(ScrapeException.class)
                .hasMessageContaining("no-search-form");
    }

    @Test
    void needsLocationAndWindowAndAnHttpsAddress() {
        ScraperEvidenceTest.Sessions sessions = new ScraperEvidenceTest.Sessions(new FakeRenderedPageSession());
        assertThatThrownBy(() -> source(sessions).findCertificates(CertificateQuery.ofPenalty("TEST-PEN-1")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(sessions.opened).isZero();
        assertThatThrownBy(() -> new SearchPageCertificateSource(sessions, "http://search.example.invalid/x.jsf", new CertificatePageParser(),
                Duration.ofMinutes(1), Clock.systemUTC())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new SearchPageCertificateSource(sessions, URL, new CertificatePageParser(),
                Duration.ofHours(1), Clock.systemUTC())).isInstanceOf(IllegalArgumentException.class);
    }

    // ---- through the lookup service: the step trace ----

    private static final NoticeDetails NOTICE = new NoticeDetails("Fictitious offence", DAY, LocalTime.of(11, 12, 13), "SAMPLE ROAD",
            new BigDecimal("100.00"), new BigDecimal("100.00"), NoticeStatus.PAYABLE, "x", EnforcementMethod.CAMERA);

    private static PenaltyLookupResult lookup(SearchPageCertificateSource source) {
        LookupTrace.begin(false);
        return new LookupPenaltyService(r -> new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, r.infringementNumber(), "x", NOTICE,
                List.of(), "TEST", "TEST-LOC-01"), new StubMediaAdapter("/samples"), source, null)
                .lookup(new PenaltyLookupRequest("9000000004", DAY));
    }

    @Test
    void theCertificatesStepReturnsRowsAndMarksTheCoveringOnes() {
        PenaltyLookupResult r = lookup(source(new ScraperEvidenceTest.Sessions(new FakeRenderedPageSession())));
        assertThat(r.certificates()).hasSize(5);
        assertThat(r.certificates().stream().filter(c -> c.coversOffence()).count()).isEqualTo(2);
        LookupTrace.Entry e = LookupTrace.current().entries().get(LookupStep.CERTIFICATES.ordinal());
        assertThat(e.outcome().label()).isEqualTo("ok");
    }

    @Test
    void aRefusalShowsAsBlockedOnTheCertificatesStepAndNeverFailsTheLookup() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.searchFailure = "browser step 'certificates' failed: blocked-403";
        PenaltyLookupResult r = lookup(source(new ScraperEvidenceTest.Sessions(fake)));
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.certificates()).isEmpty();
        LookupTrace.Entry e = LookupTrace.current().entries().get(LookupStep.CERTIFICATES.ordinal());
        assertThat(e.outcome().label()).isEqualTo("failed");
        assertThat(e.cause()).isEqualTo(StepCause.BLOCKED_403);
        assertThat(e.cause().token()).isEqualTo("blocked-403");
    }

    @Test
    void aCaptchaStopsWithItsOwnCause() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.searchFailure = "browser step 'certificates' failed: captcha present: stopping, not automating past it";
        lookup(source(new ScraperEvidenceTest.Sessions(fake)));
        assertThat(LookupTrace.current().entries().get(LookupStep.CERTIFICATES.ordinal()).cause()).isEqualTo(StepCause.CAPTCHA);
    }

    // ---- parser: the data table shapes a JSF page may use ----

    @Test
    void parsesAScrollableTableWithSeparateHeaderAndResponsiveTitles() {
        List<CertificateRef> rows = new CertificatePageParser().parseRendered(CertificatePageParserTest.fixture("search-page-results-split.html"));
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).description()).isEqualTo("TEST split certificate");
        assertThat(rows.get(0).type()).isEqualTo("Camera");
        assertThat(rows.get(0).covers(LocalDateTime.of(2026, 10, 30, 11, 12))).isTrue();
    }

    @Test
    void anEmptyDataTableMessageIsAnEmptyListNotAnError() {
        assertThat(new CertificatePageParser().parseRendered(CertificatePageParserTest.fixture("search-page-empty-primefaces.html"))).isEmpty();
    }

    // ---- diagnostics: structure only ----

    @Test
    void theFormStructureNamesFieldsAndFixedVocabularyOnly() {
        String d = SearchPageDiagnostic.structureOf(CertificatePageParserTest.fixture("search-page-form.html"));
        assertThat(d).contains("forms=1").contains("form-ids=j_idt10")
                .contains("visible-inputs=text#j_idt10:loc|j_idt10:loc,text#j_idt10:dfrom_input|j_idt10:dfrom_input,text#j_idt10:dto_input|j_idt10:dto_input")
                .contains("hidden-names=j_idt10,javax.faces.ViewState")
                .contains("labels=date/time-from,date/time-to,location-code")
                .contains("label-for=3/3")
                .contains("buttons=search#j_idt10:go,clear#j_idt10:clr,close#j_idt10:cls")
                .contains("calendar-widget=yes").contains("viewstate=yes").contains("captcha=no").contains("tables=th0/tr3/td6/col2");
        assertThat(d).doesNotContain("TEST").doesNotContain("2000").doesNotContain("Customer Enquiry");
        assertThat(SearchPageDiagnostic.hasCaptcha(CertificatePageParserTest.fixture("search-page-form.html"))).isFalse();
    }

    @Test
    void theResultStructureCountsRowsAndNamesHeadersByVocabularyOnly() {
        String d = SearchPageDiagnostic.structureOf(CertificatePageParserTest.fixture("results-certificates.html"));
        assertThat(d).contains("headers=description,type,period,certified,expiry").contains("tables=th5/tr5/td25/col5");
        assertThat(d).doesNotContain("TEST").doesNotContain("2026").doesNotContain("Camera");
        String split = SearchPageDiagnostic.structureOf(CertificatePageParserTest.fixture("search-page-results-split.html"));
        assertThat(split).contains("tables=th5/tr0/td0/col0,th0/tr1/td5/col5");
        String empty = SearchPageDiagnostic.structureOf(CertificatePageParserTest.fixture("search-page-empty-primefaces.html"));
        assertThat(empty).contains("empty-marker=yes").contains("/colspan").contains("message-words=no-record");
    }

    @Test
    void aCaptchaWidgetIsRecognised() {
        assertThat(SearchPageDiagnostic.hasCaptcha("<html><body><div class=\"g-recaptcha\"></div></body></html>")).isTrue();
    }
}
