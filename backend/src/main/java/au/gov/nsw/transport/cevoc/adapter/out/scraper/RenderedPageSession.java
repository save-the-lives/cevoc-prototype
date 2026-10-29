package au.gov.nsw.transport.cevoc.adapter.out.scraper;

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

    /** An image's bytes as the browser holds them. */
    record ImageBytes(String contentType, byte[] data) {}

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
     * Fills vehicleNumber on the separate images form, presses "View images" and returns the rendered DOM
     * (state 3 on success; the plate form still present if the registration was not accepted).
     */
    String submitPlate(String registration) throws IOException, InterruptedException;

    /** Bytes behind a blob: URL seen in the DOM returned by this same session; empty if unavailable. */
    Optional<ImageBytes> imageBytes(String blobUrl) throws IOException, InterruptedException;

    @Override
    void close();
}
