package au.gov.nsw.transport.cevoc.domain;

/**
 * One piece of evidence shown to the motorist (image, video or certificate).
 * Inside the application, {@code url} first holds the media object key (as produced by a
 * PenaltyLookupPort); LookupPenaltyService replaces it with a link from SignedLinkPort before returning.
 */
public record EvidenceItem(Kind kind, String title, String url) {
    public enum Kind { IMAGE, VIDEO, CERTIFICATE }

    /** Evidence referring to a stored media object by key; the link is resolved later. */
    public static EvidenceItem ofObject(Kind kind, String title, String objectKey) {
        return new EvidenceItem(kind, title, objectKey);
    }

    public EvidenceItem withUrl(String link) {
        return new EvidenceItem(kind, title, link);
    }
}
