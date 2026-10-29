package au.gov.nsw.transport.cevoc.adapter.out.scraper;

/**
 * How certificates are keyed on the source page. RESOLVED: the real page (searchCertificates.jsf) has
 * mandatory fields Location code, Date/Time from and Date/Time to, so VIA_ENFORCEMENT_SITE is the default:
 * penalty -> enforcement site (location code, see EnforcementSiteResolver) -> certificates valid in the window.
 */
public enum CertificateKeyStrategy {
    /** Location code + date/time range. Matches the real page. Default. */
    VIA_ENFORCEMENT_SITE,
    /** Search by penalty number. NOT supported by the real page; kept only for fictitious fixtures/other sources. */
    BY_PENALTY
}
