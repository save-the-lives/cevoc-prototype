package au.gov.nsw.transport.cevoc.domain;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One piece of evidence shown to the motorist (image, video or certificate).
 * Inside the application, {@code url} first holds the media object key (as produced by a
 * PenaltyLookupPort); LookupPenaltyService replaces it with a link from SignedLinkPort before returning.
 * For images the optional {@code previewUrl} (thumbnail) and {@code mediumUrl} let the page show a light copy first and
 * load larger sizes only when asked; {@code url} is always the original at full resolution. {@code width} and
 * {@code height} are the original's pixel size (null when unknown) so the page can reserve space.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record EvidenceItem(Kind kind, String title, String url, String previewUrl, String mediumUrl, Integer width, Integer height) {
    public enum Kind { IMAGE, VIDEO, CERTIFICATE }

    public EvidenceItem(Kind kind, String title, String url) {
        this(kind, title, url, null, null, null, null);
    }

    /** Evidence referring to a stored media object by key; the link is resolved later. */
    public static EvidenceItem ofObject(Kind kind, String title, String objectKey) {
        return new EvidenceItem(kind, title, objectKey);
    }

    public EvidenceItem withUrl(String link) {
        return new EvidenceItem(kind, title, link, previewUrl, mediumUrl, width, height);
    }

    public EvidenceItem withVariants(String preview, String medium) {
        return new EvidenceItem(kind, title, url, preview, medium, width, height);
    }

    public EvidenceItem withSize(int w, int h) {
        return w > 0 && h > 0 ? new EvidenceItem(kind, title, url, previewUrl, mediumUrl, w, h) : this;
    }
}
