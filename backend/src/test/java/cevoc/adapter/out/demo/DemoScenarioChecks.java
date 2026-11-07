package cevoc.adapter.out.demo;

import cevoc.application.port.in.LookupSink;
import cevoc.domain.CertificateAssessment;
import cevoc.domain.CertificateCoverage;
import cevoc.domain.CertificateItem;
import cevoc.domain.EvidenceItem;
import cevoc.domain.LookupStep;
import cevoc.domain.LookupTrace;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.RegistrationScope;
import cevoc.domain.StepOutcome;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Runs every listed case through the real lookup service and compares what comes back with the statuses the scenario
 * declares (the ones printed in docs/DEMO-DATA.md and shown in the hub). Returns the mismatches; empty means consistent.
 */
final class DemoScenarioChecks {

    private DemoScenarioChecks() {}

    /** What one run of a case produced, reduced to the facts the statuses are about. */
    static final class Observed implements LookupSink {
        final List<String> events = new ArrayList<>();
        PenaltyLookupResult details;
        List<EvidenceItem> evidence = List.of();
        boolean plateRequired;
        Map<String, Object> extra = Map.of();
        List<CertificateItem> certificates = List.of();
        CertificateCoverage coverage;
        List<CertificateAssessment.UncoveredType> uncoveredTypes = List.of();
        String error;
        LookupTrace trace;

        @Override public void details(PenaltyLookupResult d) { events.add("details"); details = d; }
        @Override public void evidence(List<EvidenceItem> e, boolean p) { events.add("evidence"); evidence = e; plateRequired = p; }
        @Override public void extra(Map<String, Object> d) { events.add("extra"); extra = d; }
        @Override public void certificates(List<CertificateItem> c) { events.add("certificates"); certificates = c; }
        @Override public void certificates(List<CertificateItem> c, CertificateCoverage cov) { certificates(c); coverage = cov; }
        @Override public void certificates(List<CertificateItem> c, CertificateCoverage cov,
                                           List<CertificateAssessment.UncoveredType> ut) { certificates(c, cov); uncoveredTypes = ut; }
        @Override public void done() { events.add("done"); }
        @Override public void error(String cause) { events.add("error"); error = cause; }
    }

    static Observed run(DemoCaseFactory factory, String number, String plate) {
        Observed o = new Observed();
        var service = new cevoc.application.service.LookupPenaltyService(new DemoPenaltyLookupAdapter(factory),
                DemoSignedLinks.wrapping((k, v) -> {
                    throw new IllegalStateException("not a demo key");
                }), new DemoCertificateSource(), null);
        LookupTrace.begin(false);
        try {
            PenaltyLookupRequest request = new PenaltyLookupRequest(number, LocalDate.of(2026, 11, 5));
            if (plate == null) {
                service.lookup(request, o);
            } else {
                RegistrationScope.with(plate, () -> {
                    service.lookup(request, o);
                    return null;
                });
            }
        } finally {
            o.trace = LookupTrace.end();
        }
        return o;
    }

    /** The statuses read from what was returned. */
    static Map<DemoInfo, DemoStatus> observe(DemoScenario s, Observed o) {
        Map<DemoInfo, DemoStatus> m = new EnumMap<>(DemoInfo.class);
        if (o.details != null && o.details.status() == PenaltyLookupResult.Status.NOT_FOUND) {
            for (DemoInfo i : DemoInfo.values()) {
                m.put(i, DemoStatus.NOT_APPLICABLE);
            }
            return m;
        }
        if (o.details != null && o.details.status() == PenaltyLookupResult.Status.UNAVAILABLE) {
            for (DemoInfo i : DemoInfo.values()) {
                m.put(i, DemoStatus.FAILED);
            }
            return m;
        }
        boolean failedAfterDetails = o.error != null;
        long images = o.evidence.stream().filter(e -> e.kind() == EvidenceItem.Kind.IMAGE).count();
        boolean video = o.evidence.stream().anyMatch(e -> e.kind() == EvidenceItem.Kind.VIDEO);
        boolean held = o.plateRequired || (s.plate() != DemoScenario.Plate.NONE && images == 0 && !failedAfterDetails);
        m.put(DemoInfo.IMAGES, failedAfterDetails ? DemoStatus.FAILED : held ? DemoStatus.HELD_BACK
                : images == 0 ? DemoStatus.NOT_RETURNED : images == 1 ? DemoStatus.PARTIAL : DemoStatus.AVAILABLE);
        m.put(DemoInfo.VIDEO, failedAfterDetails ? DemoStatus.FAILED : held ? DemoStatus.HELD_BACK
                : video ? DemoStatus.AVAILABLE : DemoStatus.NOT_RETURNED);
        LookupTrace.Entry cert = o.trace.entries().stream().filter(e -> e.step() == LookupStep.CERTIFICATES).findFirst().orElseThrow();
        long covering = o.certificates.stream().filter(CertificateItem::coversOffence).count();
        boolean hasUncoveredTypes = o.uncoveredTypes != null && !o.uncoveredTypes.isEmpty();
        m.put(DemoInfo.CERTIFICATES, failedAfterDetails ? DemoStatus.FAILED : cert.outcome() == StepOutcome.FAILED ? DemoStatus.FAILED
                : o.certificates.isEmpty() && !hasUncoveredTypes ? DemoStatus.NOT_RETURNED
                : covering == 0 || hasUncoveredTypes ? DemoStatus.PARTIAL : DemoStatus.AVAILABLE);
        // Details: the page has display rules for a red light notice only (offence text or the timeSinceRed key), and only for a date
        // from 1 Jan 2000. Within that, the keys the red light block shows are timeSinceRed and speedLimit.
        boolean rules = o.details != null && o.details.notice() != null
                && (o.details.notice().offenceDescription().toLowerCase().contains("red")
                || o.extra.containsKey("timeSinceRed"))
                && !o.details.notice().offenceDate().isBefore(LocalDate.of(2000, 1, 1));
        int shown = (o.extra.containsKey("timeSinceRed") ? 1 : 0) + (o.extra.containsKey("speedLimit") ? 1 : 0);
        m.put(DemoInfo.DETAILS, !rules ? DemoStatus.NO_RULES : shown == 2 ? DemoStatus.AVAILABLE
                : shown == 0 ? DemoStatus.NOT_RETURNED : DemoStatus.PARTIAL);
        return m;
    }

    static List<String> problems(DemoCaseFactory factory) {
        List<String> out = new ArrayList<>();
        for (DemoScenario s : factory.scenarios()) {
            // The declared statuses are those a visitor sees first, with no plate given.
            Observed o = run(factory, s.number(), null);
            Map<DemoInfo, DemoStatus> seen = observe(s, o);
            if (!seen.equals(s.expected())) {
                out.add(s.number() + " declares " + s.expected() + " but returns " + seen + " events=" + o.events);
            }
            if (s.plate() != DemoScenario.Plate.NONE) {
                if (!o.plateRequired || !o.evidence.isEmpty()) {
                    out.add(s.number() + " must hold images back without a plate");
                }
                Observed right = run(factory, s.number(), DemoCaseFactory.PLATE);
                boolean released = !right.plateRequired && right.evidence.stream().anyMatch(e -> e.kind() == EvidenceItem.Kind.IMAGE);
                if (released != (s.plate() == DemoScenario.Plate.GATED)) {
                    out.add(s.number() + " must release images for " + DemoCaseFactory.PLATE + " only when the plate is accepted");
                }
                Observed wrong = run(factory, s.number(), "WRONG1");
                if (wrong.plateRequired || !wrong.evidence.isEmpty()
                        || wrong.trace.firstFailed() == null || wrong.trace.firstFailed().step() != LookupStep.VIEW_IMAGES) {
                    out.add(s.number() + " must refuse a wrong plate and say so in the trace");
                }
            }
        }
        return out;
    }
}
