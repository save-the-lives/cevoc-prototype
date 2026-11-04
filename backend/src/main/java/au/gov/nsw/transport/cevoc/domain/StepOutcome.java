package au.gov.nsw.transport.cevoc.domain;

import java.util.Locale;

/** How one {@link LookupStep} ended. */
public enum StepOutcome {
    OK, FAILED, SKIPPED;

    public String label() {
        return name().toLowerCase(Locale.ROOT);
    }
}
