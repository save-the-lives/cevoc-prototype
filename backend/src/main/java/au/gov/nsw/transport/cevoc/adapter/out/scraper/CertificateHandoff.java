package au.gov.nsw.transport.cevoc.adapter.out.scraper;

/**
 * Carries the RENDERED certificates page from the evidence lookup to the certificate source for the SAME call
 * (same thread). The browser session that read the page is closed by the time the certificate source runs, so the
 * page text is handed over here, held in a thread-local, consumed once by {@link #take} and always cleared at the
 * start of the next lookup. It is never logged, cached or stored. Like {@link RequestScopedRegistration}, nothing on
 * the public API sets it: only the browser evidence adapter does.
 */
public final class CertificateHandoff {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private CertificateHandoff() {}

    public static void put(String renderedHtml) {
        CURRENT.set(renderedHtml);
    }

    /** Returns the handed-over page (or null) and forgets it. */
    public static String take() {
        String v = CURRENT.get();
        CURRENT.remove();
        return v;
    }

    public static void clear() {
        CURRENT.remove();
    }
}
