package au.gov.nsw.transport.cevoc.domain;

/** One piece of evidence shown to the motorist (image, video or certificate). */
public record EvidenceItem(Kind kind, String title, String url) {
    public enum Kind { IMAGE, VIDEO, CERTIFICATE }
}
