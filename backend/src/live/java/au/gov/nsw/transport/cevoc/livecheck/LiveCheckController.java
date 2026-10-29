package au.gov.nsw.transport.cevoc.livecheck;

import au.gov.nsw.transport.cevoc.adapter.out.scraper.RequestScopedRegistration;
import au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
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

    public LiveCheckController(LookupPenaltyUseCase useCase) {
        this.useCase = useCase;
    }

    public record Body(String notice, String offenceDate, String registration) {
        @Override
        public String toString() {
            return "Body";
        }
    }

    @GetMapping(value = "/ping", produces = MediaType.TEXT_PLAIN_VALUE)
    public String ping() {
        return "ok";
    }

    @PostMapping(value = "/lookup", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> lookup(@RequestBody Body body) {
        if (body == null || body.notice() == null || !NOTICE.matcher(body.notice()).matches()) {
            return ResponseEntity.badRequest().body("notice number not in the expected shape\n");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(body.offenceDate());
        } catch (DateTimeParseException | NullPointerException e) {
            return ResponseEntity.badRequest().body("offence date must be YYYY-MM-DD\n");
        }
        String plate = body.registration();
        if (plate != null && !plate.isBlank() && !PLATE.matcher(plate).matches()) {
            return ResponseEntity.badRequest().body("registration not in the expected shape\n");
        }
        var request = new PenaltyLookupRequest(body.notice(), date);
        var result = RequestScopedRegistration.with(plate, () -> useCase.lookup(request));
        return ResponseEntity.ok(LiveCheckSummary.of(result));
    }
}
