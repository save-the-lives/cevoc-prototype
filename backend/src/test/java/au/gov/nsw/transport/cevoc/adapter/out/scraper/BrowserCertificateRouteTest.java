package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import au.gov.nsw.transport.cevoc.adapter.out.stub.StubMediaAdapter;
import au.gov.nsw.transport.cevoc.application.service.LookupPenaltyService;
import au.gov.nsw.transport.cevoc.domain.CertificateItem;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The browser route end to end with a fake session: images state, then the certification link followed in the same
 * session, then the certificate source parses the handed-over page. FICTITIOUS fixtures only.
 */
class BrowserCertificateRouteTest {

    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));

    @AfterEach
    void cleanUp() {
        CertificateHandoff.clear();
        LookupDiagnostic.clear();
    }

    private static LookupPenaltyService service(FakeRenderedPageSession fake) {
        ScraperSettings s = new ScraperSettings(true, "https://penalty.example.invalid/customer_service/finesonline/",
                "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1), Duration.ofSeconds(1), Duration.ofSeconds(60), 1024);
        ScraperEvidenceLookupAdapter evidence = new ScraperEvidenceLookupAdapter(s, new ScraperEvidenceTest.Sessions(fake),
                new RevenueNswPageParser(), new ScraperEvidenceTest.FakeStorage(),
                Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC), new RequestScopedRegistration());
        return new LookupPenaltyService(evidence, new StubMediaAdapter("/samples"),
                new BrowserCertificateSourceAdapter(new CertificatePageParser()), null);
    }

    private static PenaltyLookupResult lookup(FakeRenderedPageSession fake) {
        LookupDiagnostic.clear();
        return RequestScopedRegistration.with("TST123", () -> service(fake).lookup(REQ));
    }

    @Test
    void followsTheLinkAndReturnsTheListWithTheCoveringRowMarked() throws Exception {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        PenaltyLookupResult r = lookup(fake);

        assertThat(fake.calls).containsSubsequence("submitPlate", "imageBytes", "openCertification");
        assertThat(r.certificates()).hasSize(2);
        CertificateItem first = r.certificates().get(0);
        assertThat(first.description()).isEqualTo("TEST camera certificate one");
        assertThat(first.type()).isEqualTo("Camera");
        assertThat(first.periodText()).contains("01/01/2026");
        assertThat(first.certifiedDate()).isEqualTo("2026-01-02");
        assertThat(first.expiryDate()).isEqualTo("2027-06-30");
        assertThat(first.coversOffence()).isTrue();
        assertThat(r.certificates().get(1).coversOffence()).isFalse();
        String json = com.fasterxml.jackson.databind.json.JsonMapper.builder().findAndAddModules().build().writeValueAsString(r);
        assertThat(json).contains("\"certificates\"").doesNotContain("cameraCode").doesNotContain("0123456789abcdef");
        String diag = LookupDiagnostic.take();
        assertThat(diag).contains("step=certificates; outcome=ok").contains("step=certificates-parse; outcome=ok; rows=2")
                .contains("cert-headers=description,type,period,certified,expiry");
    }

    @Test
    void labelledLayoutIsReadToo() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.certificationHtml = FakeRenderedPageSession.fixture("fictitious-certification-labelled.html");
        PenaltyLookupResult r = lookup(fake);
        assertThat(r.certificates()).hasSize(2);
        assertThat(r.certificates().get(0).coversOffence()).isTrue();
        assertThat(r.certificates().get(1).periodText()).contains("2025");
    }

    @Test
    void linkLeadingNowhereOrFailingNeverFailsTheLookup() {
        FakeRenderedPageSession none = new FakeRenderedPageSession();
        none.certificationHtml = null;
        PenaltyLookupResult r1 = lookup(none);
        assertThat(r1.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r1.certificates()).isEmpty();
        assertThat(LookupDiagnostic.take()).contains("step=certificates; outcome=failed; cause=no-page");

        FakeRenderedPageSession failing = new FakeRenderedPageSession();
        failing.failCertification = true;
        PenaltyLookupResult r2 = lookup(failing);
        assertThat(r2.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r2.evidence()).isNotEmpty();
        assertThat(r2.certificates()).isEmpty();
        assertThat(LookupDiagnostic.take()).contains("step=certificates; outcome=failed; cause=timeout");
    }

    @Test
    void withoutImagesTheStepIsSkippedAndNoPageIsFollowed() {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        LookupDiagnostic.clear();
        PenaltyLookupResult r = service(fake).lookup(REQ); // no registration: summary state only
        assertThat(r.certificates()).isEmpty();
        assertThat(fake.calls).doesNotContain("openCertification");
        assertThat(LookupDiagnostic.take()).contains("step=certificates; outcome=skipped; cause=no-images");
    }

    @Test
    void anUnrecognisedPageThrowsAndIsConsumedOnce() {
        CertificateHandoff.put(FakeRenderedPageSession.fixture("fictitious-certification-unknown.html"));
        BrowserCertificateSourceAdapter source = new BrowserCertificateSourceAdapter(new CertificatePageParser());
        CertificateQuery q = CertificateQuery.ofLocation("TEST-LOC-01", LocalDateTime.of(2026, 1, 15, 0, 0), LocalDateTime.of(2026, 1, 15, 23, 59));
        assertThatThrownBy(() -> source.findCertificates(q)).isInstanceOf(ScrapeException.class);
        assertThat(source.findCertificates(q)).isEmpty(); // nothing left to reuse
    }

    @Test
    void structureDiagnosticsCarryNoPageText() {
        String d = LookupDiagnostic.certPageStructureOf(FakeRenderedPageSession.fixture("fictitious-certification-table.html"));
        assertThat(d).contains("cert-tables=1").contains("cert-rows=2").contains("cert-datatable-class=yes")
                .contains("cert-location-field=no");
        assertThat(d).doesNotContain("TEST").doesNotContain("2026").doesNotContain("Camera");
    }
}
