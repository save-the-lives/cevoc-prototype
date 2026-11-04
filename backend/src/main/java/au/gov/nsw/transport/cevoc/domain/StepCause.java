package au.gov.nsw.transport.cevoc.domain;

import java.util.Locale;

/**
 * Whitelisted reason tokens for a failed or skipped step. Nothing else is ever recorded: no page text, no
 * exception message, no value the owner typed. {@link #of(Throwable)} only inspects a message for keywords.
 */
public enum StepCause {
    TIMEOUT,
    NETWORK_ERROR,
    BROWSER_NOT_INSTALLED,
    BROWSER_LAUNCH_FAILED,
    BROWSER_CLOSED,
    BUTTON_NOT_FOUND,
    SELECTOR_MATCHES_MANY,
    PAGE_NOT_RECOGNISED,
    SUMMARY_TIMEOUT,
    NOT_MATCHED,
    EXTRA_LOGIN_FIELDS,
    NOTICE_MISMATCH,
    PLATE_NOT_ACCEPTED,
    NO_IMAGES,
    NO_IMAGE_BYTES,
    NOT_CONFIGURED,
    SOURCE_FAILED,
    INTERRUPTED,
    BLOCKED_401,
    BLOCKED_403,
    BLOCKED_429,
    CAPTCHA,
    NO_SEARCH_FORM,
    OTHER,
    // skipped
    NO_PLATE,
    NO_PLATE_FORM,
    NO_CAMERA_CODE,
    NO_CERTIFICATION_LINK,
    NOT_APPLICABLE,
    PRIOR_FAILURE;

    public String token() {
        return name().toLowerCase(Locale.ROOT).replace('_', '-');
    }

    /** Maps a failure onto the vocabulary. Only keywords of the (first line of the) message are examined. */
    public static StepCause of(Throwable t) {
        if (t instanceof InterruptedException) {
            return INTERRUPTED;
        }
        String m = t == null || t.getMessage() == null ? "" : t.getMessage().lines().findFirst().orElse("").toLowerCase(Locale.ROOT);
        if (m.contains("net::err_")) {
            return NETWORK_ERROR;
        } else if (m.contains("timeout")) {
            return TIMEOUT;
        } else if (m.contains("executable doesn't exist") || m.contains("playwright was just installed")) {
            return BROWSER_NOT_INSTALLED;
        } else if (m.contains("no matching button")) {
            return BUTTON_NOT_FOUND;
        } else if (m.contains("has been closed")) {
            return BROWSER_CLOSED;
        } else if (m.contains("failed to launch") || m.contains("browsertype.launch") || m.startsWith("could not start the browser")) {
            return BROWSER_LAUNCH_FAILED;
        } else if (m.contains("blocked-403")) {
            return BLOCKED_403;
        } else if (m.contains("blocked-401")) {
            return BLOCKED_401;
        } else if (m.contains("blocked-429")) {
            return BLOCKED_429;
        } else if (m.contains("captcha")) {
            return CAPTCHA;
        } else if (m.contains("no-search-form")) {
            return NO_SEARCH_FORM;
        } else if (m.contains("strict mode violation")) {
            return SELECTOR_MATCHES_MANY;
        }
        return OTHER;
    }
}
