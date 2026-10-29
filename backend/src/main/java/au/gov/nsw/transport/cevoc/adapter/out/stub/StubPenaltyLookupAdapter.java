package au.gov.nsw.transport.cevoc.adapter.out.stub;

import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;

/**
 * Fictitious data so the customer journey works before real sources are wired in.
 * Scenarios by notice number (all invented):
 *   9000000001  speed camera notice: images, video, certificate
 *   9000000002  parking notice replaced by a caution: officer issued, no evidence
 *   9000000003  travel without a valid ticket, camera-based: image evidence and certificate
 *   X...        no match
 *   anything else: generic camera sample
 */
public class StubPenaltyLookupAdapter implements PenaltyLookupPort {

    private static final String SOURCE = "STUB";

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest r) {
        String n = r.infringementNumber();
        if (n.toUpperCase().startsWith("X")) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.NOT_FOUND, n,
                    "We could not match that notice number and offence date.", null, List.of(), SOURCE);
        }
        return switch (n) {
            case "9000000002" -> found(n, new NoticeDetails("Park continuously for longer than indicated",
                    r.offenceDate(), LocalTime.of(14, 47), "SAMPLE STREET, SAMPLETOWN",
                    new BigDecimal("136.00"), new BigDecimal("0.00"), NoticeStatus.CAUTION,
                    "This penalty has been replaced with a caution. You no longer need to pay.",
                    EnforcementMethod.OFFICER_ISSUED), List.of());
            case "9000000003" -> found(n, new NoticeDetails("Travel or attempt travel without valid ticket - adult",
                    r.offenceDate(), LocalTime.of(8, 5), "SAMPLE STATION",
                    new BigDecimal("200.00"), new BigDecimal("200.00"), NoticeStatus.PAYABLE,
                    "Payment is due.", EnforcementMethod.CAMERA),
                    List.of(new EvidenceItem(EvidenceItem.Kind.IMAGE, "Sample image", "/samples/image-1.jpg"),
                            new EvidenceItem(EvidenceItem.Kind.CERTIFICATE, "Sample enforcement centre certificate", "/samples/cert-1.pdf")));
            default -> found(n, new NoticeDetails("Exceed speed limit by 10km/h or less",
                    r.offenceDate(), LocalTime.of(11, 12), "SAMPLE ROAD, SAMPLETOWN",
                    new BigDecimal("277.00"), new BigDecimal("277.00"), NoticeStatus.PAYABLE,
                    "Payment is due.", EnforcementMethod.CAMERA),
                    List.of(new EvidenceItem(EvidenceItem.Kind.IMAGE, "Sample image", "/samples/image-1.jpg"),
                            new EvidenceItem(EvidenceItem.Kind.VIDEO, "Sample video", "/samples/video-1.mp4"),
                            new EvidenceItem(EvidenceItem.Kind.CERTIFICATE, "Sample camera certificate", "/samples/cert-1.pdf")));
        };
    }

    private static PenaltyLookupResult found(String n, NoticeDetails d, List<EvidenceItem> evidence) {
        return new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, n, "Prototype data only.", d, evidence, SOURCE);
    }
}
