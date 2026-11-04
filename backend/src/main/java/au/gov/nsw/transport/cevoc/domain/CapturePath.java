package au.gov.nsw.transport.cevoc.domain;

import java.util.Locale;

/** How an evidence image's bytes were obtained from the source page. */
public enum CapturePath {
    CANVAS, FETCH, SCREENSHOT, UNKNOWN;

    public String label() {
        return name().toLowerCase(Locale.ROOT);
    }
}
