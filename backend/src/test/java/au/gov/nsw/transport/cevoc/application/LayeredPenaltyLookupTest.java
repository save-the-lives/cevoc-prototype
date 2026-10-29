package au.gov.nsw.transport.cevoc.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.application.port.out.EvidenceSourcePort;
import au.gov.nsw.transport.cevoc.application.service.LayeredPenaltyLookup;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LayeredPenaltyLookupTest {

    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9100000001", LocalDate.of(2026, 1, 1));
    private static final PenaltyLookupResult FOUND = new PenaltyLookupResult(
            PenaltyLookupResult.Status.FOUND, "9100000001", "m", null, List.of(), "STUB");
    private static final PenaltyLookupResult OFF = new PenaltyLookupResult(
            PenaltyLookupResult.Status.LIVE_LOOKUP_OFF, "9100000001", "off", null, List.of(), "STUB");
    private static final CertificateSourcePort CERTS = r -> List.of(
            EvidenceItem.ofObject(EvidenceItem.Kind.CERTIFICATE, "Fake cert", "fake.pdf"));

    @Test
    void manifestHitIsServedWithoutTouchingLiveSources() {
        EvidenceSourcePort boom = r -> { throw new AssertionError("must not be called"); };
        assertSame(FOUND, new LayeredPenaltyLookup(r -> FOUND, boom, CERTS).find(REQ));
    }

    @Test
    void missWithSwitchesOffStaysSwitchedOff() {
        assertSame(OFF, new LayeredPenaltyLookup(r -> OFF, null, null).find(REQ));
    }

    @Test
    void missWithLiveSourceOnFallsThrough() {
        EvidenceSourcePort ev = r -> Optional.of(new EvidenceSourcePort.Found(null,
                List.of(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Fake image", "fake.jpg"))));
        PenaltyLookupResult res = new LayeredPenaltyLookup(r -> OFF, ev, CERTS).find(REQ);
        assertEquals(PenaltyLookupResult.Status.FOUND, res.status());
        assertEquals(2, res.evidence().size());
        assertEquals("LIVE", res.source());
    }

    @Test
    void missWithLiveSourceOnButNothingReturnedStaysSwitchedOff() {
        assertSame(OFF, new LayeredPenaltyLookup(r -> OFF, r -> Optional.empty(), r -> List.of()).find(REQ));
    }
}
