package au.gov.nsw.transport.cevoc.domain;

import java.util.Locale;

/**
 * How an evidence image's bytes were obtained from the source page. RESPONSE = the body of the source's own image response,
 * untouched (original bytes and content type); the others are copies made from the rendered page.
 */
public enum CapturePath {
    RESPONSE, CANVAS, FETCH, SCREENSHOT, UNKNOWN;

    public String label() {
        return name().toLowerCase(Locale.ROOT);
    }
}
