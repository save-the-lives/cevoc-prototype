package cevoc.adapter.out.demo;

import cevoc.adapter.out.demo.DemoScenario.Plate;
import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.EvidenceItem;
import cevoc.domain.LookupStep;
import cevoc.domain.LookupTrace;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.PenaltyLookupResult.Status;
import cevoc.domain.RegistrationScope;
import cevoc.domain.StepCause;
import java.util.List;
import java.util.Locale;

/**
 * The demo route, a fourth way to answer the same lookup beside the browser route, the plain HTTP route and the future
 * API route. It returns the same canonical result (typed notice, flexible details map, certificates, status and message),
 * reports the same step trace, and fires the same progress callbacks (details first, then evidence), so everything
 * downstream behaves as for a real route. It makes no network call. The notice number alone decides the case; the offence
 * date typed in is not compared (the case carries its own). The registration is read for this one call only and never kept.
 */
public final class DemoPenaltyLookupAdapter implements PenaltyLookupPort {

    private static final String NOT_MATCHED = "We could not match that notice number and offence date.";
    private static final String UNAVAILABLE = "The lookup source is not available right now.";
    private static final String PLATE_REFUSED = "Notice details found. The registration number was not accepted, so no images are shown.";

    private final DemoCaseFactory factory;

    public DemoPenaltyLookupAdapter(DemoCaseFactory factory) {
        this.factory = factory;
    }

    public DemoCaseFactory factory() {
        return factory;
    }

    /** True when the number is a built demo number; only then is this route consulted. */
    public boolean handles(String number) {
        return factory.available() && factory.scenario(number).isPresent();
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        return find(request, LookupProgress.NONE);
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
        String number = request.infringementNumber();
        DemoScenario s = factory.scenario(number).orElse(null);
        LookupTrace trace = LookupTrace.current();
        if (s == null || s.outcome() == DemoScenario.Outcome.NOT_FOUND) {
            trace.fail(LookupStep.READ_SUMMARY, StepCause.NOT_MATCHED);
            return new PenaltyLookupResult(Status.NOT_FOUND, number, NOT_MATCHED, null, List.of(), DemoCaseFactory.SOURCE);
        }
        if (s.outcome() == DemoScenario.Outcome.TIMEOUT) {
            trace.fail(LookupStep.READ_SUMMARY, StepCause.TIMEOUT);
            return new PenaltyLookupResult(Status.UNAVAILABLE, number, UNAVAILABLE, null, List.of(), DemoCaseFactory.SOURCE);
        }
        // Two separate payloads, as in the real flow: the text record, and the media set from the media source.
        DemoTextRecord text = factory.textRecord(s);
        DemoMediaSet media = factory.mediaSet(s);
        trace.ok(LookupStep.READ_SUMMARY, 0);
        String plate = normalise(RegistrationScope.current());
        boolean held = s.plate() != Plate.NONE;
        progress.details(new PenaltyLookupResult(Status.FOUND, number, text.summary(), text.notice(), List.of(),
                DemoCaseFactory.SOURCE, null, List.of(), null, held && plate == null));
        if (s.outcome() == DemoScenario.Outcome.IMAGES_FAIL) {
            trace.fail(LookupStep.CAPTURE_IMAGES, StepCause.NO_IMAGE_BYTES);
            return new PenaltyLookupResult(Status.UNAVAILABLE, number, UNAVAILABLE, null, List.of(), DemoCaseFactory.SOURCE);
        }
        String summary = text.summary();
        List<EvidenceItem> evidence = List.of();
        boolean plateRequired = false;
        if (held && plate == null) {
            plateRequired = true;
            trace.skip(LookupStep.GIVE_PLATE, StepCause.NO_PLATE);
            trace.skip(LookupStep.VIEW_IMAGES, StepCause.NO_PLATE);
            trace.skip(LookupStep.CAPTURE_IMAGES, StepCause.NO_IMAGES);
        } else if (held && !(s.plate() == Plate.GATED && DemoCaseFactory.PLATE.equals(plate))) {
            trace.ok(LookupStep.GIVE_PLATE, 0);
            trace.fail(LookupStep.VIEW_IMAGES, StepCause.PLATE_NOT_ACCEPTED);
            trace.skip(LookupStep.CAPTURE_IMAGES, StepCause.PRIOR_FAILURE);
            summary = PLATE_REFUSED;
        } else {
            if (held) {
                trace.ok(LookupStep.GIVE_PLATE, 0);
                trace.ok(LookupStep.VIEW_IMAGES, 0);
            }
            evidence = media.evidence();
            if (s.images() > 0) {
                trace.ok(LookupStep.CAPTURE_IMAGES, 0);
            } else {
                trace.skip(LookupStep.CAPTURE_IMAGES, StepCause.NO_IMAGES);
            }
        }
        progress.evidence(evidence, plateRequired);
        if (s.certs() == DemoScenario.Certs.FAILED) {
            trace.ok(LookupStep.CERTIFICATES, 0);
            trace.fail(LookupStep.CERTIFICATES, StepCause.SOURCE_FAILED);
        } else {
            trace.ok(LookupStep.CERTIFICATES, 0);
        }
        // No camera code on the result: the demo supplies its own certificate rows and must never trigger a certificate source.
        return new PenaltyLookupResult(Status.FOUND, number, summary, text.notice(), evidence, DemoCaseFactory.SOURCE, null,
                text.certificates(), null, plateRequired, text.details());
    }

    private static String normalise(String raw) {
        if (raw == null) {
            return null;
        }
        String p = raw.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        return p.isEmpty() ? null : p;
    }
}
