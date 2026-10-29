package au.gov.nsw.transport.cevoc.adapter.out.scraper;

/**
 * OPEN QUESTION (Arjan to confirm): how are certificates keyed on the source page?
 * BY_PENALTY: search by penalty number returns certificates directly.
 * VIA_ENFORCEMENT_SITE: penalty number gives an enforcement site number, which then gives certificates.
 */
public enum CertificateKeyStrategy { BY_PENALTY, VIA_ENFORCEMENT_SITE }
