package au.gov.nsw.transport.cevoc.domain;

/**
 * What we know when asking for certificates. {@code penaltyNumber} is always present.
 * {@code enforcementSiteNumber} is optional: some sources need it as a second key (open question).
 */
public record CertificateQuery(String penaltyNumber, String enforcementSiteNumber) {
    public static CertificateQuery ofPenalty(String penaltyNumber) {
        return new CertificateQuery(penaltyNumber, null);
    }
}
