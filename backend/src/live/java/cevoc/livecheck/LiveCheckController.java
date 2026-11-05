package cevoc.livecheck;

import cevoc.adapter.out.scraper.live.NetworkMapHolder;
import cevoc.application.port.in.LookupPenaltyUseCase;
import cevoc.domain.PenaltyLookupRequest;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Local check endpoint for the owner. Exists only in the live-browser build AND when cevoc.live-check.enabled=true
 * (scripts/live-check.sh sets that, plus server.address=127.0.0.1). It carries the plate into the lookup for this
 * one call only and answers with a redacted text summary. It is not part of the public API and not in the default
 * build. Input is validated to simple characters, never logged, never echoed.
 */
@RestController
@RequestMapping("/live-check")
@ConditionalOnProperty(name = "cevoc.live-check.enabled", havingValue = "true")
public class LiveCheckController {

    private static final Pattern NOTICE = Pattern.compile("[A-Za-z0-9]{4,20}");
    private static final Pattern PLATE = Pattern.compile("[A-Za-z0-9 -]{1,10}");

    private final LookupPenaltyUseCase useCase;

    private final int port;
    private final String origin;
    private final String certPageUrl;

    public LiveCheckController(LookupPenaltyUseCase useCase, @Value("${server.port:8080}") int port,
                               @Value("${cevoc.cors.allowed-origins:}") String origins,
                               @Value("${cevoc.certificates.search-page.url:" + cevoc.adapter.out.scraper.CertificateScraperProperties.DEFAULT_PAGE_URL + "}") String certPageUrl) {
        this.useCase = useCase;
        this.certPageUrl = certPageUrl;
        this.port = port;
        this.origin = origins.split(",")[0].trim();
    }

    /**
     * Fetches a public link of the result from inside this app (relative links go to the local port), sending the web
     * page's origin, and keeps numbers only: status, content type, byte count and whether the cross-origin header came back.
     */
    private PublicPathCheck.Fetched fetch(String url) {
        try {
            String target = url.startsWith("/") ? "http://127.0.0.1:" + port + url : url;
            var request = java.net.http.HttpRequest.newBuilder(java.net.URI.create(target)).timeout(java.time.Duration.ofSeconds(30))
                    .header("Origin", origin).GET().build();
            var response = java.net.http.HttpClient.newHttpClient().send(request, java.net.http.HttpResponse.BodyHandlers.ofByteArray());
            String type = response.headers().firstValue("Content-Type").orElse("none");
            boolean cors = response.headers().firstValue("Access-Control-Allow-Origin").isPresent();
            return new PublicPathCheck.Fetched(response.statusCode(), type, response.body().length, cors);
        } catch (java.io.IOException | RuntimeException e) {
            return new PublicPathCheck.Fetched(0, "none", 0, false);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new PublicPathCheck.Fetched(0, "none", 0, false);
        }
    }

    public record Body(String notice, String offenceDate, String registration, Boolean includeImages, Boolean networkMap) {
        public Body(String notice, String offenceDate, String registration) {
            this(notice, offenceDate, registration, null, null);
        }

        @Override
        public String toString() {
            return "Body";
        }
    }

    @GetMapping(value = "/ping", produces = MediaType.TEXT_PLAIN_VALUE)
    public String ping() {
        return "ok";
    }

    /** Response when the owner's page asks for images: the same redacted summary, plus the captured images. */
    public record WithImages(String summary, List<LiveCheckRunner.Image> images) {}

    @PostMapping(value = "/lookup")
    public ResponseEntity<?> lookup(@RequestBody Body body) {
        if (body == null || body.notice() == null || !NOTICE.matcher(body.notice()).matches()) {
            return text(ResponseEntity.badRequest(), "notice number not in the expected shape\n");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(body.offenceDate());
        } catch (DateTimeParseException | NullPointerException e) {
            return text(ResponseEntity.badRequest(), "offence date must be YYYY-MM-DD\n");
        }
        String plate = body.registration();
        if (plate != null && !plate.isBlank() && !PLATE.matcher(plate).matches()) {
            return text(ResponseEntity.badRequest(), "registration not in the expected shape\n");
        }
        boolean includeImages = Boolean.TRUE.equals(body.includeImages());
        // Network map: structure-only call map, only when asked for (default off). See NetworkMapRedaction.
        boolean wantMap = Boolean.TRUE.equals(body.networkMap());
        LiveCheckRunner.Outcome outcome;
        try {
            outcome = LiveCheckRunner.run(useCase, new PenaltyLookupRequest(body.notice(), date), plate, includeImages,
                    wantMap ? NetworkMapHolder::request : () -> { },
                    () -> (wantMap ? String.join("\n", NetworkMapHolder.take()) + "\n" : "")
                            + cevoc.adapter.out.scraper.HostReachability.report(certPageUrl), this::fetch);
        } finally {
            NetworkMapHolder.take();
        }
        if (!includeImages) {
            // Default (and the GitHub workflow route): text only, never image bytes.
            return text(ResponseEntity.ok(), outcome.summary());
        }
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).contentType(MediaType.APPLICATION_JSON)
                .body(new WithImages(outcome.summary(), outcome.images()));
    }

    private static ResponseEntity<String> text(ResponseEntity.BodyBuilder b, String body) {
        return b.cacheControl(CacheControl.noStore()).contentType(MediaType.TEXT_PLAIN).body(body);
    }
}
