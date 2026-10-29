package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import java.util.List;

/**
 * Driven port: a live source of camera certificates (CERTIFICATE items). Optional and off by default;
 * an adapter must only be created when cevoc.certificate.scraper.enabled=true
 * (env CEVOC_CERTIFICATE_SCRAPER_ENABLED) and approval has been obtained. If certificates turn out to be
 * keyed by enforcement site, a separate EnforcementSiteLookupPort maps notice to site first.
 */
public interface CertificateSourcePort {
    List<EvidenceItem> certificates(PenaltyLookupRequest request);
}
