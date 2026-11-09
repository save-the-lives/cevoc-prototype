package cevoc.adapter.out.scraper;

import cevoc.domain.ImageSize;
import java.io.IOException;
import java.util.Optional;

/**
 * Outbound port for ONE browser session on the myPenalty site. The site is an Angular app (base href
 * /customer_service/finesonline/), so a plain HTTP fetch returns an empty shell. Every method therefore
 * returns the RENDERED DOM (HTML after scripts have run), and the session keeps the cookies and blob: URLs
 * the page creates.
 *
 * Image bytes must come from the same session: the images are blob: URLs that only exist inside the browser
 * that rendered them, so they cannot be fetched by URL from anywhere else ({@link #imageBytes}).
 *
 * Contract for implementations:
 * <ul>
 *   <li>Sequential and polite (identifying user agent, pacing, timeouts, size cap); see ScraperSettings.</li>
 *   <li>{@link #submitPlate} receives the vehicle registration. It must never be logged, stored, cached,
 *       echoed in exceptions, screenshots or traces, or kept after the call.</li>
 *   <li>{@link #close} discards the browser context, so blob: URLs and the plate die with it.</li>
 * </ul>
 * The Playwright implementation lives in src/live/java and is compiled only with the live-browser Maven profile;
 * the default build has no browser dependency on the classpath.
 */
public interface RenderedPageSession extends AutoCloseable {

    /**
     * An image's bytes as the browser holds them, plus numbers about them ({@link ImageSize}: how they were
     * captured, rendered and natural size of the element; zeros when unknown). No page text.
     */
    record ImageBytes(String contentType, byte[] data, ImageSize size) {
        public ImageBytes(String contentType, byte[] data) {
            this(contentType, data, ImageSize.unknown());
        }
    }

    /** Opens the login page (state 1) and returns its rendered DOM. */
    String loginPage() throws IOException, InterruptedException;

    /**
     * Fills pnn and dateOfOffence, presses Next and returns the rendered DOM that follows
     * (state 2 on success; the login page again, or an error, otherwise).
     *
     * @param offenceDate already formatted DD/MM/YYYY
     */
    String submitLogin(String noticeNumber, String offenceDate) throws IOException, InterruptedException;

    /**
     * Fills pnn, dateOfOffence and the identity fields (lastName, firstName), presses Next.
     * Default delegates to {@link #submitLogin(String, String)} for sessions that don't support identity fields.
     */
    default String submitLogin(String noticeNumber, String offenceDate, String familyName, String givenNames)
            throws IOException, InterruptedException {
        return submitLogin(noticeNumber, offenceDate);
    }

    /**
     * Overload that also fills organisation. Default delegates to the name-only version.
     */
    default String submitLogin(String noticeNumber, String offenceDate, String familyName, String givenNames, String organisation)
            throws IOException, InterruptedException {
        return submitLogin(noticeNumber, offenceDate, familyName, givenNames);
    }

    /**
     * Fills identity fields on the "Additional penalty information" page and submits.
     * This page appears AFTER the initial login for certain notice types (seatbelt, nomination).
     */
    default String submitIdentity(String familyName, String givenNames) throws IOException, InterruptedException {
        throw new UnsupportedOperationException("submitIdentity not supported by this session");
    }

    /**
     * Clicks Skip on the "Additional penalty information" page to bypass identity entry.
     * The evidence is still accessible without providing the name.
     */
    default String skipIdentity() throws IOException, InterruptedException {
        throw new UnsupportedOperationException("skipIdentity not supported by this session");
    }

    /**
     * The rendered DOM as it is right now, without acting on the page. Used to keep reading after
     * {@link #submitLogin} until the summary has rendered. Empty when the session cannot re-read (default).
     */
    default Optional<String> currentPage() throws IOException, InterruptedException {
        return Optional.empty();
    }

    /**
     * Fills vehicleNumber on the separate images form, presses "View images" and returns the rendered DOM
     * (state 3 on success; the plate form still present if the registration was not accepted).
     */
    String submitPlate(String registration) throws IOException, InterruptedException;

    /**
     * The image exactly as the source served it: the body and content type of its own network response, untouched (no
     * re-encoding). For a thumbnail in the strip this makes the page load the full-size version first. {@code ref} is the
     * image's page reference, {@code blobUrl} the element showing it. Empty when no such response was seen; callers then
     * fall back to {@link #imageBytes}. Default: not supported.
     */
    default Optional<ImageBytes> originalImage(String ref, String blobUrl) throws IOException, InterruptedException {
        return Optional.empty();
    }

    /** Bytes behind a blob: URL seen in the DOM returned by this same session; empty if unavailable. */
    Optional<ImageBytes> imageBytes(String blobUrl) throws IOException, InterruptedException;

    /**
     * Follows the evidence page's "View certification details" link in THIS session (the signed link value never
     * leaves the browser) and returns the rendered DOM of the certificates page it leads to. Empty when the page has
     * no such link. Failures are IOException. Default: not supported.
     */
    default Optional<String> openCertification() throws IOException, InterruptedException {
        return Optional.empty();
    }

    /**
     * Opens the public certificates SEARCH page ({@code pageUrl}), fills Location code and Date/Time from and to, presses
     * SEARCH and returns the rendered DOM of the results (a table, or an empty-result page). A refusal (401, 403, 429)
     * is an IOException whose message contains {@code blocked-<status>}; the attempt stops there and is never retried
     * another way. Neither the location code nor the dates may be logged or echoed. Default: not supported.
     */
    default Optional<String> searchCertificates(String pageUrl, String locationCode, java.time.LocalDateTime from,
                                                java.time.LocalDateTime to) throws IOException, InterruptedException {
        return Optional.empty();
    }

    /**
     * The allow-listed cookies (see {@link SessionCookies#ALLOWED}) this session holds for the search page after a successful
     * {@link #searchCertificates}, for the HTTP-first path. Default: none.
     */
    default java.util.List<SessionCookies.Cookie> sessionCookies() {
        return java.util.List.of();
    }

    @Override
    void close();
}
