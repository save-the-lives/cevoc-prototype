package cevoc.application.service;

import cevoc.application.port.in.LookupPenaltyUseCase;
import cevoc.application.port.in.LookupSink;
import cevoc.application.port.out.CertificateSourcePort;
import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.application.port.out.SignedLinkPort;
import cevoc.domain.CertificateItem;
import cevoc.domain.CertificateMatch;
import cevoc.domain.CertificateQuery;
import cevoc.domain.EvidenceItem;
import cevoc.domain.ImageVariant;
import cevoc.domain.SignedLink;
import cevoc.domain.LookupStep;
import cevoc.domain.LookupTrace;
import cevoc.domain.StepCause;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

public class LookupPenaltyService implements LookupPenaltyUseCase {

    /** Long enough that a page opened and read for a while can still load the larger sizes when the viewer is opened. */
    static final Duration LINK_VALIDITY = Duration.ofMinutes(15);

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
            return r.withEvidence(link(r.evidence()));
        } catch (RuntimeException e) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.UNAVAILABLE,
                    request.infringementNumber(), "We could not load this right now. Please try again.",
                    null, List.of(), "ERROR");
        }
    }

    /** Replaces object keys by links: the original, and for images the smaller copies when the storage has them. */
    private List<EvidenceItem> link(List<EvidenceItem> items) {
        if (items == null) {
            return List.of();
        }
        return items.stream().map(e -> {
            String key = e.url();
            EvidenceItem linked = e.withUrl(signedLinks.linkFor(key, LINK_VALIDITY).url());
            if (e.kind() == EvidenceItem.Kind.IMAGE) {
                String thumb = signedLinks.linkFor(key, ImageVariant.THUMBNAIL, LINK_VALIDITY).map(SignedLink::url).orElse(null);
                String medium = signedLinks.linkFor(key, ImageVariant.MEDIUM, LINK_VALIDITY).map(SignedLink::url).orElse(null);
                linked = linked.withVariants(thumb, medium);
            }
            return linked;
        }).toList();
    }

    /**
     * The same lookup in parts over one call: details as soon as the adapter knows them (or at the end for adapters
     * that cannot say earlier), then evidence, then certificates, then done. One call means one browser session and the
     * request-scoped registration is used exactly as for {@link #lookup}.
     */
    @Override
    public void lookup(PenaltyLookupRequest request, LookupSink sink) {
        boolean[] sent = new boolean[2];
        PenaltyLookupResult raw;
        try {
            raw = penaltyLookup.find(request, new LookupProgress() {
                @Override
                public void details(PenaltyLookupResult partial) {
                    if (!sent[0]) {
                        sent[0] = true;
                        sink.details(partial.withEvidence(List.of()));
                    }
                }

                @Override
                public void evidence(List<EvidenceItem> items, boolean plateRequired) {
                    if (sent[0] && !sent[1]) {
                        sent[1] = true;
                        sink.evidence(link(items), plateRequired);
                    }
                }
            });
        } catch (RuntimeException e) {
            sink.error(StepCause.of(e).token());
            return;
        }
        try {
            if (!sent[0]) {
                sent[0] = true;
                sink.details(raw.withEvidence(List.of()));
            } else if (raw.status() != PenaltyLookupResult.Status.FOUND) {
                // Details were already sent as found; the rest of the lookup then failed.
                LookupTrace.Entry failed = LookupTrace.current().firstFailed();
                sink.error(failed == null || failed.cause() == null ? StepCause.SOURCE_FAILED.token() : failed.cause().token());
                return;
            }
            if (raw.status() != PenaltyLookupResult.Status.FOUND) {
                sink.done();
                return;
            }
            if (!sent[1]) {
                sent[1] = true;
                sink.evidence(link(raw.evidence()), raw.plateRequired());
            }
            PenaltyLookupResult withCerts = withCertificates(raw);
            sink.certificates(withCerts.certificates());
            sink.done();
        } catch (RuntimeException e) {
            sink.error(StepCause.of(e).token());
        }
    }

    /**
     * Fills the certificate list from the certificate source when the adapter did not already supply one.
     * Never fails the lookup: no camera code, no port or a source failure all give an empty list (failure with a note).
     */
    private PenaltyLookupResult withCertificates(PenaltyLookupResult r) {
        LookupTrace trace = LookupTrace.current();
        if (!r.certificates().isEmpty() || certificates == null || r.cameraCode() == null || r.cameraCode().isBlank()
                || r.notice() == null || r.notice().offenceDate() == null || r.notice().offenceTime() == null) {
            if (!trace.has(LookupStep.CERTIFICATES)) {
                trace.skip(LookupStep.CERTIFICATES, r.cameraCode() == null || r.cameraCode().isBlank() ? StepCause.NO_CAMERA_CODE
                        : StepCause.NOT_APPLICABLE);
            }
            return r;
        }
        long start = System.nanoTime();
        try {
            LocalDateTime offenceAt = r.notice().offenceDate().atTime(r.notice().offenceTime());
            CertificateQuery query = CertificateQuery.aroundOffence(r.cameraCode(), r.notice().offenceDate(),
                    r.notice().offenceTime(), certificateWindowMargin);
            List<CertificateItem> items = certificates.findCertificatesCovering(query, offenceAt).stream()
                    .map(CertificateItem::from).toList();
            if (!trace.has(LookupStep.CERTIFICATES)) {
                trace.ok(LookupStep.CERTIFICATES, (System.nanoTime() - start) / 1_000_000);
            }
            return r.withCertificates(items, items.isEmpty() ? "No certificates found" : null);
        } catch (RuntimeException e) {
            if (!trace.has(LookupStep.CERTIFICATES)) {
                trace.ok(LookupStep.CERTIFICATES, (System.nanoTime() - start) / 1_000_000);
            }
            StepCause cause = StepCause.of(e);
            trace.fail(LookupStep.CERTIFICATES, cause == StepCause.OTHER ? StepCause.SOURCE_FAILED : cause);
            return r.withCertificates(List.of(), "Certificates unavailable");
        }
    }
}
