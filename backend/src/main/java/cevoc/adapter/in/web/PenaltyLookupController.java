package cevoc.adapter.in.web;

import cevoc.application.port.in.LookupPenaltyUseCase;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.IdentityScope;
import cevoc.domain.RegistrationScope;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public, unauthenticated endpoint for the motorist-facing app. */
@RestController
@RequestMapping("/api/penalty-lookups")
public class PenaltyLookupController {

    private final LookupPenaltyUseCase useCase;

    public PenaltyLookupController(LookupPenaltyUseCase useCase) {
        this.useCase = useCase;
    }

    /**
     * {@code registration} is optional and is deliberately not validated with annotations (a failed constraint would
     * put the rejected value in an exception message). It is only handed to the adapters for this one request, see
     * {@link #lookup}, and is kept out of {@code toString}.
     */
    public record LookupBody(
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9 -]{4,20}$", message = "Check the notice number") String infringementNumber,
            @NotNull @PastOrPresent LocalDate offenceDate,
            String registration,
            String familyName,
            String givenNames) {

        public LookupBody(String infringementNumber, LocalDate offenceDate) {
            this(infringementNumber, offenceDate, null, null, null);
        }

        public LookupBody(String infringementNumber, LocalDate offenceDate, String registration) {
            this(infringementNumber, offenceDate, registration, null, null);
        }

        @Override
        public String toString() {
            return "LookupBody";
        }
    }

    @PostMapping
    public PenaltyLookupResult lookup(@Valid @RequestBody LookupBody body) {
        PenaltyLookupRequest request = new PenaltyLookupRequest(body.infringementNumber().trim(), body.offenceDate());
        String plate = cleanRegistration(body.registration());
        // Request-scoped: held in a thread-local for this call only, removed in a finally block, never stored, cached or logged.
        java.util.function.Supplier<PenaltyLookupResult> action = () -> useCase.lookup(request);
        if (plate != null) {
            var inner = action;
            action = () -> RegistrationScope.with(plate, inner);
        }
        if (body.familyName() != null && !body.familyName().isBlank()) {
            var inner = action;
            var identity = new IdentityScope.Identity(body.familyName().trim(), body.givenNames() != null ? body.givenNames().trim() : "");
            action = () -> IdentityScope.with(identity, inner);
        }
        return action.get();
    }

    /** Letters and digits only (spaces and dashes dropped), 1 to 8 characters; anything else is treated as not given. */
    static String cleanRegistration(String raw) {
        if (raw == null) {
            return null;
        }
        String p = raw.replaceAll("[\\s-]", "");
        return p.matches("[A-Za-z0-9]{1,8}") ? p : null;
    }
}
