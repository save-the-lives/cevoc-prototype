package au.gov.nsw.transport.cevoc.domain;

import java.util.Locale;

/**
 * The fixed, ordered vocabulary of steps in one penalty lookup. The names belong to the lookup, not to any
 * technology: a browser adapter and a future direct-API adapter report against the SAME steps (an adapter that
 * has no such stage records it as skipped). Extend by appending, never by renaming.
 */
public enum LookupStep {
    START_BROWSER,
    OPEN_LOGIN,
    SUBMIT_LOGIN,
    READ_SUMMARY,
    GIVE_PLATE,
    VIEW_IMAGES,
    CAPTURE_IMAGES,
    CERTIFICATES;

    /** Lower-case, hyphenated: start-browser, open-login, ... */
    public String label() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    /** 1-based position in the vocabulary. */
    public int number() {
        return ordinal() + 1;
    }
}
