package cevoc.adapter.out.scraper;

/**
 * A certificate provider that can be temporarily skipped (e.g. because of an active back-off window).
 * Implemented by {@link BackoffCertificateSource}.
 */
interface Skippable {
    /** True when this provider should be skipped for the current lookup. */
    boolean shouldSkip();
}
