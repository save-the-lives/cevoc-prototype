package cevoc.adapter.out.demo;

import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;

/**
 * Consults the demo route first for a demo notice number and hands every other number, untouched, to the configured
 * route. A demo number is never passed on, so no real source is ever asked about a fictitious number.
 */
public final class DemoFirstPenaltyLookupAdapter implements PenaltyLookupPort {

    private final DemoPenaltyLookupAdapter demo;
    private final PenaltyLookupPort next;

    public DemoFirstPenaltyLookupAdapter(DemoPenaltyLookupAdapter demo, PenaltyLookupPort next) {
        this.demo = demo;
        this.next = next;
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request) {
        return demo.handles(request.infringementNumber()) ? demo.find(request) : next.find(request);
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest request, LookupProgress progress) {
        return demo.handles(request.infringementNumber()) ? demo.find(request, progress) : next.find(request, progress);
    }
}
