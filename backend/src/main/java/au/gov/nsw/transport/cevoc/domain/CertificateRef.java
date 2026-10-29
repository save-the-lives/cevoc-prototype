package au.gov.nsw.transport.cevoc.domain;

import java.time.LocalDate;

/** A certificate found by a source. {@code issuedDate} may be null. {@code documentRef} is the source's own reference for the document, not a public URL. */
public record CertificateRef(String certificateNumber, String title, LocalDate issuedDate, String documentRef) {}
