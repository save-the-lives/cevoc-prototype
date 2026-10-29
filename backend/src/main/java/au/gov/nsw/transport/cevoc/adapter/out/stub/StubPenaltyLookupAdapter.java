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
 *   9000000004  red-light camera notice: two images, certificate, no video
 *   X...        no match
 *   anything else: not in the sample data, so we report that live lookup is switched off
 *   (no live source adapter is enabled; the stub is the manifest stand-in)
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
                    List.of(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Sample image", "image-1.jpg"),
                            EvidenceItem.ofObject(EvidenceItem.Kind.CERTIFICATE, "Sample enforcement centre certificate", "cert-1.pdf")));
            case "9000000004" -> found(n, new NoticeDetails("Fail to stop at red traffic light",
                    r.offenceDate(), LocalTime.of(17, 31), "SAMPLE AVENUE, SAMPLETOWN",
                    new BigDecimal("464.00"), new BigDecimal("464.00"), NoticeStatus.PAYABLE,
                    "Payment is due.", EnforcementMethod.CAMERA),
                    List.of(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Sample image 1", "image-1.jpg"),
                            EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Sample image 2", "image-2.jpg"),
                            EvidenceItem.ofObject(EvidenceItem.Kind.CERTIFICATE, "Sample camera certificate", "cert-1.pdf")));
            case "9000000001" -> found(n, new NoticeDetails("Exceed speed limit by 10km/h or less",
                    r.offenceDate(), LocalTime.of(11, 12), "SAMPLE ROAD, SAMPLETOWN",
                    new BigDecimal("277.00"), new BigDecimal("277.00"), NoticeStatus.PAYABLE,
                    "Payment is due.", EnforcementMethod.CAMERA),
                    List.of(EvidenceItem.ofObject(EvidenceItem.Kind.IMAGE, "Sample image", "image-1.jpg"),
                            EvidenceItem.ofObject(EvidenceItem.Kind.VIDEO, "Sample video", "video-1.mp4"),
                            EvidenceItem.ofObject(EvidenceItem.Kind.CERTIFICATE, "Sample camera certificate", "cert-1.pdf")));
            default -> new PenaltyLookupResult(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF, n,
                    "Looking up other notices is switched off for now, until approvals are in place. You can try the sample notice numbers.",
                    null, List.of(), SOURCE);
        };
    }

    private static PenaltyLookupResult found(String n, NoticeDetails d, List<EvidenceItem> evidence) {
        return new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, n, "Prototype data only.", d, evidence, SOURCE);
    }
}
