package cevoc.domain;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonValue;

/**
 * The plain answer to "was the camera certified on the offence date?", sent with the (filtered) certificate list.
 *
 * @param status  {@code covered} (a certificate was in force), {@code gap} (none was; the nearest certificates either side
 *                are listed) or {@code none} (nothing usable was found)
 * @param side    only for {@code gap}: {@code between} (one expired before and the next starts after), {@code before-only}
 *                (only earlier certificates exist) or {@code after-only} (only later ones exist)
 * @param gapDays only for {@code gap}: for {@code between}, the whole days with no certificate (0 = back to back); for
 *                {@code before-only}, the days from expiry to the offence; for {@code after-only}, the days from the
 *                offence to the start
 * @param message the sentence to show the motorist
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record CertificateCoverage(Status status, Side side, Long gapDays, String message) {

    public enum Status {
        COVERED, GAP, NONE;

        @JsonValue
        public String wire() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    public enum Side {
        BETWEEN("between"), BEFORE_ONLY("before-only"), AFTER_ONLY("after-only");

        private final String wire;

        Side(String wire) {
            this.wire = wire;
        }

        @JsonValue
        public String wire() {
            return wire;
        }
    }
}
