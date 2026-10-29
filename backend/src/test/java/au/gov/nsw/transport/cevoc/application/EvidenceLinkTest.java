package au.gov.nsw.transport.cevoc.application;

import static org.junit.jupiter.api.Assertions.assertEquals;

import au.gov.nsw.transport.cevoc.adapter.out.stub.StubMediaAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.application.service.LookupPenaltyService;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class EvidenceLinkTest {

    @Test
    void evidenceUrlsComeFromSignedLinkPort() {
        var service = new LookupPenaltyService(new StubPenaltyLookupAdapter(), new StubMediaAdapter("https://media.example.test/samples/"));
        var result = service.lookup(new PenaltyLookupRequest("9000000001", LocalDate.of(2024, 1, 2)));
        assertEquals(3, result.evidence().size());
        assertEquals("https://media.example.test/samples/image-1.jpg", result.evidence().get(0).url());
        assertEquals("https://media.example.test/samples/video-1.mp4", result.evidence().get(1).url());
        assertEquals("https://media.example.test/samples/cert-1.pdf", result.evidence().get(2).url());
    }
}
