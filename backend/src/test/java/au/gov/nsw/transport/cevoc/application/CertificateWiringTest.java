package au.gov.nsw.transport.cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.adapter.out.ManifestPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubMediaAdapter;
import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.application.service.LookupPenaltyService;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class CertificateWiringTest {

    private static final LocalDate DAY = LocalDate.of(2026, 1, 15);
    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", DAY);
    private static final NoticeDetails NOTICE = new NoticeDetails("Fictitious offence", DAY, LocalTime.of(17, 31),
            "SAMPLE ROAD", new BigDecimal("100.00"), new BigDecimal("100.00"), NoticeStatus.PAYABLE, "x",
            EnforcementMethod.CAMERA);

    private static PenaltyLookupPort evidence(String cameraCode) {
        return r -> new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, r.infringementNumber(), "x", NOTICE,
                List.of(), "TEST", cameraCode);
    }

    private static CertificateRef ref(String desc, LocalDateTime from, LocalDateTime to) {
        return new CertificateRef(desc, "Camera", "p", from, to, DAY.atStartOfDay(), DAY.plusYears(1).atStartOfDay(), null);
    }

    private static class FakeCerts implements CertificateSourcePort {
        final List<CertificateQuery> queries = new ArrayList<>();
        final List<CertificateRef> rows;
        final RuntimeException failure;

        FakeCerts(List<CertificateRef> rows, RuntimeException failure) {
            this.rows = rows;
            this.failure = failure;
        }

        @Override
        public List<CertificateRef> findCertificates(CertificateQuery q) {
            queries.add(q);
            if (failure != null) {
                throw failure;
            }
            return rows;
        }
    }

    private static LookupPenaltyService service(PenaltyLookupPort p, CertificateSourcePort c, Duration margin) {
        return new LookupPenaltyService(p, new StubMediaAdapter("https://media.example.test/samples/"), c, margin);
    }

    @Test
    void queriesByCameraCodeAndMarksCoveringRow() {
        var certs = new FakeCerts(List.of(
                ref("old", DAY.minusYears(3).atStartOfDay(), DAY.minusYears(2).atStartOfDay()),
                ref("current", DAY.minusDays(10).atStartOfDay(), DAY.plusDays(10).atTime(23, 59))), null);
        PenaltyLookupResult r = service(evidence("7109"), certs, null).lookup(REQ);

        assertThat(certs.queries).hasSize(1);
        assertThat(certs.queries.get(0).locationCode()).isEqualTo("7109");
        assertThat(certs.queries.get(0).from()).isEqualTo(DAY.atStartOfDay());
        assertThat(r.certificates()).hasSize(2);
        assertThat(r.certificates().get(0).coversOffence()).isFalse();
        assertThat(r.certificates().get(1).coversOffence()).isTrue();
        assertThat(r.certificates().get(1).expiryDate()).isEqualTo("2027-01-15");
    }

    @Test
    void marginNarrowsTheWindow() {
        var certs = new FakeCerts(List.of(), null);
        service(evidence("7109"), certs, Duration.ofMinutes(30)).lookup(REQ);
        assertThat(certs.queries.get(0).from()).isEqualTo(DAY.atTime(17, 1));
        assertThat(certs.queries.get(0).to()).isEqualTo(DAY.atTime(18, 1));
    }

    @Test
    void noCameraCodeOrNoPortGivesEmptyListAndNoQuery() {
        var certs = new FakeCerts(List.of(ref("c", DAY.atStartOfDay(), DAY.atTime(23, 59))), null);
        assertThat(service(evidence(null), certs, null).lookup(REQ).certificates()).isEmpty();
        assertThat(certs.queries).isEmpty();
        PenaltyLookupResult r = service(evidence("7109"), null, null).lookup(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.certificates()).isEmpty();
    }

    @Test
    void certificateFailureDegradesWithoutFailingTheLookup() {
        var certs = new FakeCerts(null, new IllegalStateException("boom"));
        PenaltyLookupResult r = service(evidence("7109"), certs, null).lookup(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.certificates()).isEmpty();
        assertThat(r.certificatesNote()).isEqualTo("Certificates unavailable");
    }

    @Test
    void manifestCertificatesAreKeptAndMarked() {
        var certs = new FakeCerts(List.of(), null);
        PenaltyLookupResult r = service(new ManifestPenaltyLookupAdapter(), certs, null).lookup(REQ);
        assertThat(certs.queries).isEmpty();
        assertThat(r.certificates()).hasSize(3);
        assertThat(r.certificates().stream().filter(c -> c.coversOffence()).count()).isEqualTo(1);
        PenaltyLookupResult other = service(new ManifestPenaltyLookupAdapter(), certs, null)
                .lookup(new PenaltyLookupRequest("9000000001", DAY));
        assertThat(other.certificates()).hasSize(3);
        assertThat(other.certificates().stream().filter(c -> c.coversOffence()).count()).isEqualTo(1);
    }

    @Test
    void jsonShapeHasExactlyTheAgreedFieldsAndNoInternals() throws Exception {
        var certs = new FakeCerts(List.of(ref("current", DAY.minusDays(1).atStartOfDay(), DAY.atTime(23, 59))), null);
        PenaltyLookupResult r = service(evidence("7109"), certs, null).lookup(REQ);
        JsonNode json = new ObjectMapper().findAndRegisterModules().valueToTree(r);
        JsonNode c = json.get("certificates").get(0);
        assertThat(c.fieldNames()).toIterable().containsExactlyInAnyOrder(
                "description", "type", "periodText", "certifiedDate", "expiryDate", "coversOffence");
        assertThat(c.get("coversOffence").isBoolean()).isTrue();
        assertThat(c.get("certifiedDate").asText()).isEqualTo("2026-01-15");
        assertThat(json.has("cameraCode")).isFalse();
        assertThat(json.has("certificatesNote")).isFalse();
        assertThat(json.toString()).doesNotContain("7109");
    }
}
