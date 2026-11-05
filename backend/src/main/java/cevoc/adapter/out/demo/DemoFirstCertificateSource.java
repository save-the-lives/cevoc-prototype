package cevoc.adapter.out.demo;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.util.List;

/**
 * Asks the demo certificate source for a demo camera code and hands every other code, untouched, to the configured certificate
 * provider (the real browser, http or api route), so a real notice looked up while demo data is on still uses the real route.
 * A demo camera code is never passed on. When no provider is configured, another code simply finds nothing.
 */
public final class DemoFirstCertificateSource implements CertificateSourcePort {

    private final DemoCertificateSource demo;
    private final CertificateSourcePort next;

    /** @param next the configured provider, or null when none is configured */
    public DemoFirstCertificateSource(DemoCertificateSource demo, CertificateSourcePort next) {
        this.demo = demo;
        this.next = next;
    }

    @Override
    public List<CertificateRef> findCertificates(CertificateQuery query) {
        if (query != null && demo.handles(query.locationCode())) {
            return demo.findCertificates(query);
        }
        return next == null ? List.of() : next.findCertificates(query);
    }
}
