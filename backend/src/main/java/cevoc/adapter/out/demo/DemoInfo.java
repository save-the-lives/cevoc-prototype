package cevoc.adapter.out.demo;

import java.util.Locale;

/** The information types whose status each demo case declares. */
public enum DemoInfo {
    IMAGES, CERTIFICATES, VIDEO, DETAILS;

    public String token() {
        return name().toLowerCase(Locale.ROOT);
    }
}
