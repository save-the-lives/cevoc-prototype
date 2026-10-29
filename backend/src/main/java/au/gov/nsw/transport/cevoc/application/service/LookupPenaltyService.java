package au.gov.nsw.transport.cevoc.application.service;

import au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase;
import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import au.gov.nsw.transport.cevoc.domain.CertificateItem;
import au.gov.nsw.transport.cevoc.domain.CertificateMatch;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

public class LookupPenaltyService implements LookupPenaltyUseCase {

    static final Duration LINK_VALIDITY = Duration.ofMinutes(5);

    private final PenaltyLookupPort penaltyLookup;
    private final SignedLinkPort signedLinks;

    private final CertificateSourcePort certificates;
    private final Duration certificateWindowMargin;

    public LookupPenaltyService(PenaltyLookupPort penaltyLookup, SignedLinkPort signedLinks) {
        this(penaltyLookup, signedLinks, null, null);
    }

    /**
     * @param certificates may be null (certificate source disabled)
     * @param certificateWindowMargin null = whole offence day; otherwise offence time +/- margin
     */
    public LookupPenaltyService(PenaltyLookupPort penaltyLookup, SignedLinkPort signedLinks,
                                CertificateSourcePort certificates, Duration certificateWindowMargin) {
        this.penaltyLookup = penaltyLookup;
        this.signedLinks = signedLinks;
        this.certificates = certificates;
        this.certificateWindowMargin = certificateWindowMargin;
    }

    @Override
    public PenaltyLookupResult lookup(PenaltyLookupRequest request) {
        try {
            PenaltyLookupResult r = withCertificates(penaltyLookup.find(request));
            if (r.evidence() == null || r.evidence().isEmpty()) {
                return r;
            }
            List<EvidenceItem> linked = r.evidence().stream()
                    .map(e -> e.withUrl(signedLinks.linkFor(e.url(), LINK_VALIDITY).url()))
                    .toList();
            return new PenaltyLookupResult(r.status(), r.infringementNumber(), r.summary(), r.notice(), linked, r.source(),
                    r.cameraCode(), r.certificates(), r.certificatesNote());
        } catch (RuntimeException e) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.UNAVAILABLE,
                    request.infringementNumber(), "We could not load this right now. Please try again.",
                    null, List.of(), "ERROR");
        }
    }

    /**
     * Fills the certificate list from the certificate source when the adapter did not already supply one.
     * Never fails the lookup: no camera code, no port or a source failure all give an empty list (failure with a note).
     */
    private PenaltyLookupResult withCertificates(PenaltyLookupResult r) {
        if (!r.certificates().isEmpty() || certificates == null || r.cameraCode() == null || r.cameraCode().isBlank()
                || r.notice() == null || r.notice().offenceDate() == null || r.notice().offenceTime() == null) {
            return r;
        }
        try {
            LocalDateTime offenceAt = r.notice().offenceDate().atTime(r.notice().offenceTime());
            CertificateQuery query = CertificateQuery.aroundOffence(r.cameraCode(), r.notice().offenceDate(),
                    r.notice().offenceTime(), certificateWindowMargin);
            List<CertificateItem> items = certificates.findCertificatesCovering(query, offenceAt).stream()
                    .map(CertificateItem::from).toList();
            return r.withCertificates(items, items.isEmpty() ? "No certificates found" : null);
        } catch (RuntimeException e) {
            return r.withCertificates(List.of(), "Certificates unavailable");
        }
    }
}
