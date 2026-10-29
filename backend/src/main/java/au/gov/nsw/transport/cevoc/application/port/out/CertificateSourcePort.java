package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.CertificateMatch;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Driven port: where enforcement-centre certificates come from. Implemented today only by an
 * inert-by-default scraping adapter; the real certificate API should replace it.
 * Returns an empty list when nothing matches. Implementations must not throw for "not found".
 */
public interface CertificateSourcePort {
    List<CertificateRef> findCertificates(CertificateQuery query);

    /** The full list from {@link #findCertificates}, with the row(s) whose Period covers the offence marked. */
    default List<CertificateMatch> findCertificatesCovering(CertificateQuery query, LocalDateTime offenceAt) {
        return CertificateMatch.mark(findCertificates(query), offenceAt);
    }
}
