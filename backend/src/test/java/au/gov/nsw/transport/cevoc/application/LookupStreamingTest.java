package au.gov.nsw.transport.cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.adapter.out.memory.InMemoryMediaAdapter;
import au.gov.nsw.transport.cevoc.application.port.in.LookupSink;
import au.gov.nsw.transport.cevoc.application.port.out.LookupProgress;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.application.service.LookupPenaltyService;
import au.gov.nsw.transport.cevoc.domain.CertificateItem;
import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The streamed lookup: order of parts, links with sizes, plate-required flag. Fictitious data only. */
class LookupStreamingTest {

    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));

    private static NoticeDetails notice() {
        return new NoticeDetails("Exceed speed limit by 10km/h or less", LocalDate.of(2026, 1, 15), LocalTime.of(11, 12), "SAMPLE ROAD",
                java.math.BigDecimal.valueOf(277), java.math.BigDecimal.valueOf(277), null, "x", EnforcementMethod.CAMERA);
    }

    static class Recorder implements LookupSink {
        final List<String> events = new ArrayList<>();
        PenaltyLookupResult details;
        List<EvidenceItem> evidence;
        boolean plateRequired;
        String cause;

        @Override public void details(PenaltyLookupResult d) { events.add("details"); details = d; }
        @Override public void evidence(List<EvidenceItem> e, boolean p) { events.add("evidence"); evidence = e; plateRequired = p; }
        @Override public void certificates(List<CertificateItem> c) { events.add("certificates"); }
        @Override public void done() { events.add("done"); }
        @Override public void error(String c) { events.add("error"); cause = c; }
    }

    private static InMemoryMediaAdapter storageWithOneImage() throws Exception {
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("", Duration.ofMinutes(20), 64L << 20, Clock.systemUTC());
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(2000, 1600, java.awt.image.BufferedImage.TYPE_INT_RGB), "jpg", out);
        m.store("scraped/x/image-1.jpg", "image/jpeg", new ByteArrayInputStream(out.toByteArray()), out.size());
        return m;
    }

    /** A port that reports progress like the live adapter does. */
    private static PenaltyLookupPort progressive(boolean plateRequired, boolean withImage) {
        return new PenaltyLookupPort() {
            @Override
            public PenaltyLookupResult find(PenaltyLookupRequest request) {
                return find(request, LookupProgress.NONE);
            }

            @Override
            public PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
                progress.details(new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "9000000004", "s", notice(), List.of(), "TEST", null,
                        List.of(), null, plateRequired));
                List<EvidenceItem> items = withImage
                        ? List.of(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Camera image 1", "scraped/x/image-1.jpg").withSize(2000, 1600))
                        : List.of();
                progress.evidence(items, plateRequired);
                return new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "9000000004", "s", notice(), items, "TEST", null,
                        List.of(), null, plateRequired);
            }
        };
    }

    @Test
    void sendsDetailsThenEvidenceThenCertificatesThenDoneWithLinksAndSizes() throws Exception {
        var service = new LookupPenaltyService(progressive(false, true), storageWithOneImage());
        Recorder r = new Recorder();
        service.lookup(REQ, r);
        assertThat(r.events).containsExactly("details", "evidence", "certificates", "done");
        assertThat(r.details.evidence()).isEmpty();
        EvidenceItem e = r.evidence.get(0);
        assertThat(e.url()).startsWith("/api/media/").doesNotContain("?").doesNotContain("scraped");
        assertThat(e.previewUrl()).endsWith("?s=thumb");
        assertThat(e.mediumUrl()).endsWith("?s=medium");
        assertThat(e.width()).isEqualTo(2000);
        assertThat(e.height()).isEqualTo(1600);
        assertThat(r.plateRequired).isFalse();
    }

    @Test
    void whenThePlateIsRequiredTheFlagIsSentAndNoImagesAreLinked() throws Exception {
        var service = new LookupPenaltyService(progressive(true, false), storageWithOneImage());
        Recorder r = new Recorder();
        service.lookup(REQ, r);
        assertThat(r.events).containsExactly("details", "evidence", "certificates", "done");
        assertThat(r.evidence).isEmpty();
        assertThat(r.plateRequired).isTrue();
    }

    @Test
    void anAdapterWithoutProgressStillGivesTheSamePartsAtTheEnd() throws Exception {
        PenaltyLookupPort plain = req -> new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "9000000004", "s", notice(),
                List.of(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Camera image 1", "scraped/x/image-1.jpg")), "TEST", null, List.of(), null, false);
        Recorder r = new Recorder();
        new LookupPenaltyService(plain, storageWithOneImage()).lookup(REQ, r);
        assertThat(r.events).containsExactly("details", "evidence", "certificates", "done");
        assertThat(r.evidence).hasSize(1);
        assertThat(r.evidence.get(0).url()).startsWith("/api/media/");
    }

    @Test
    void aNotFoundNoticeIsDetailsThenDone() throws Exception {
        PenaltyLookupPort none = req -> new PenaltyLookupResult(PenaltyLookupResult.Status.NOT_FOUND, "9000000004", "no", null, List.of(), "TEST");
        Recorder r = new Recorder();
        new LookupPenaltyService(none, storageWithOneImage()).lookup(REQ, r);
        assertThat(r.events).containsExactly("details", "done");
        assertThat(r.details.status()).isEqualTo(PenaltyLookupResult.Status.NOT_FOUND);
    }

    @Test
    void aFailureAfterTheDetailsIsAnErrorWithAFixedCauseAndNoMessage() throws Exception {
        PenaltyLookupPort failing = new PenaltyLookupPort() {
            @Override
            public PenaltyLookupResult find(PenaltyLookupRequest request) {
                return find(request, LookupProgress.NONE);
            }

            @Override
            public PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
                progress.details(new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "9000000004", "s", notice(), List.of(), "TEST"));
                return new PenaltyLookupResult(PenaltyLookupResult.Status.UNAVAILABLE, "9000000004", "later", null, List.of(), "TEST");
            }
        };
        Recorder r = new Recorder();
        new LookupPenaltyService(failing, storageWithOneImage()).lookup(REQ, r);
        assertThat(r.events).containsExactly("details", "error");
        assertThat(r.cause).matches("[a-z0-9-]+");
    }

    @Test
    void anExceptionBeforeAnyPartIsAnErrorToo() throws Exception {
        PenaltyLookupPort boom = req -> { throw new IllegalStateException("TST123 must not leak"); };
        Recorder r = new Recorder();
        new LookupPenaltyService(boom, storageWithOneImage()).lookup(REQ, r);
        assertThat(r.events).containsExactly("error");
        assertThat(r.cause).doesNotContain("TST123");
    }
}
