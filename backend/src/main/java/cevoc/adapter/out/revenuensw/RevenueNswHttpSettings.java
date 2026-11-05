package cevoc.adapter.out.revenuensw;

import java.net.URI;
import java.time.Duration;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Settings for the plain HTTP route to the Revenue NSW JSON service. There is no on/off flag: the route exists only when it
 * is selected ({@code cevoc.penalty-lookup.adapter=http}), and it does nothing unless a base URL (https, on the allow-list), the path prefix, a contact and the owner's
 * approval reference are all supplied. The path prefix is configuration on purpose (record 0010: meaning and stability
 * not yet confirmed), so no deployment-specific value lives in the code.
 */
public record RevenueNswHttpSettings(
        String baseUrl,
        String pathPrefix,
        String contact,
        String approvalReference,
        String authorizationScheme,
        String offenceDateFormat,
        Duration minInterval,
        Duration connectTimeout,
        Duration requestTimeout,
        long maxBytes,
        int summaryRetries,
        Duration retryBackoff,
        Set<String> allowedHosts) {

    public static final String DEFAULT_HOST = "api.osr.nsw.gov.au";
    public static final Duration DEFAULT_MIN_INTERVAL = Duration.ofSeconds(1);
    public static final Duration MIN_INTERVAL_FLOOR = Duration.ofMillis(500);
    public static final Duration DEFAULT_CONNECT_TIMEOUT = Duration.ofSeconds(5);
    public static final Duration DEFAULT_REQUEST_TIMEOUT = Duration.ofSeconds(15);
    public static final Duration DEFAULT_RETRY_BACKOFF = Duration.ofSeconds(2);
    public static final long DEFAULT_MAX_BYTES = 25L * 1024 * 1024;
    /** Hard ceiling on retries for the summary call: record 0010 allows at most 2. */
    public static final int MAX_SUMMARY_RETRIES = 2;
    private static final Pattern PREFIX = Pattern.compile("[A-Za-z0-9_-]{1,64}");

    public RevenueNswHttpSettings {
        allowedHosts = allowedHosts == null ? Set.of(DEFAULT_HOST) : Set.copyOf(allowedHosts);
        minInterval = minInterval == null || minInterval.compareTo(MIN_INTERVAL_FLOOR) < 0 ? MIN_INTERVAL_FLOOR : minInterval;
        summaryRetries = Math.max(0, Math.min(MAX_SUMMARY_RETRIES, summaryRetries));
        authorizationScheme = authorizationScheme == null ? "" : authorizationScheme.trim();
        offenceDateFormat = offenceDateFormat == null || offenceDateFormat.isBlank() ? "yyyy-MM-dd" : offenceDateFormat.trim();
    }

    /** Fully off. */
    public static RevenueNswHttpSettings off() {
        return new RevenueNswHttpSettings("", "", "", "", "", "yyyy-MM-dd", DEFAULT_MIN_INTERVAL, DEFAULT_CONNECT_TIMEOUT,
                DEFAULT_REQUEST_TIMEOUT, DEFAULT_MAX_BYTES, 1, DEFAULT_RETRY_BACKOFF, Set.of(DEFAULT_HOST));
    }

    /** True only when configured well enough to identify ourselves and to name the approval. */
    public boolean usable() {
        return httpsBase() != null && present(pathPrefix) && PREFIX.matcher(pathPrefix.trim()).matches()
                && present(contact) && present(approvalReference);
    }

    /** The service root up to and including {@code /fines}, or null when not usable. No trailing slash. */
    public String finesRoot() {
        URI base = httpsBase();
        if (base == null || !present(pathPrefix)) {
            return null;
        }
        return "https://" + base.getRawAuthority() + "/" + pathPrefix.trim() + "/rest/api/v2/fines";
    }

    private URI httpsBase() {
        if (!present(baseUrl)) {
            return null;
        }
        try {
            URI u = URI.create(baseUrl.trim());
            if (!"https".equalsIgnoreCase(u.getScheme()) || u.getHost() == null || u.getRawUserInfo() != null
                    || !allowedHosts.contains(u.getHost().toLowerCase(java.util.Locale.ROOT))) {
                return null;
            }
            return u;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Identifies us honestly so the site owner can see who is calling and contact us. */
    public String userAgent() {
        return "cevoc-prototype/1.0 (contact: " + contact + ")";
    }

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }
}
