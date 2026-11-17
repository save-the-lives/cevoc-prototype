package cevoc.adapter.out.revenuensw;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.domain.IdentityScope;
import org.junit.jupiter.api.Test;

/** The token body carries what was given, in the service's own shape (network map, 2026-11-17). Fictitious values. */
class RevenueNswCredentialsTest {

    @Test
    void onlyTheDateWhenNothingElseIsGiven() {
        assertThat(RevenueNswHttpLookupAdapter.credentials("15/01/2026", null, null).toString())
                .isEqualTo("{\"offenceDate\":\"15/01/2026\"}");
    }

    @Test
    void aPlateAndANameGoInTheServiceShape() {
        var who = new IdentityScope.Identity("Citizen", "Jane", null);
        assertThat(RevenueNswHttpLookupAdapter.credentials("15/01/2026", "TST123", who).toString()).isEqualTo(
                "{\"offenceDate\":\"15/01/2026\",\"vehicleRego\":\"TST123\","
                        + "\"recipientName\":{\"individual\":{\"first\":\"Jane\",\"last\":\"Citizen\"}}}");
    }

    @Test
    void neverTheTopLevelNameFieldsTheServiceIgnores() {
        var who = new IdentityScope.Identity("Citizen", "Jane", null);
        String body = RevenueNswHttpLookupAdapter.credentials("15/01/2026", null, who).toString();
        assertThat(body).doesNotContain("\"lastName\"").doesNotContain("\"firstName\"");
    }

    @Test
    void anOrganisationIsNotSentUntilItsShapeIsKnown() {
        var org = new IdentityScope.Identity(null, "", "Example Pty Ltd");
        assertThat(RevenueNswHttpLookupAdapter.credentials("15/01/2026", null, org).toString())
                .isEqualTo("{\"offenceDate\":\"15/01/2026\"}");
    }
}
