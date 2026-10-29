package au.gov.nsw.transport.cevoc.adapter.in.web;

import au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
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

    public record LookupBody(
            @NotBlank @Pattern(regexp = "^[A-Za-z0-9 -]{4,20}$", message = "Check the notice number") String infringementNumber,
            @NotNull @PastOrPresent LocalDate offenceDate) {}

    @PostMapping
    public PenaltyLookupResult lookup(@Valid @RequestBody LookupBody body) {
        return useCase.lookup(new PenaltyLookupRequest(body.infringementNumber().trim(), body.offenceDate()));
    }
}
