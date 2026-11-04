package cevoc.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** FICTITIOUS plate values only. */
class PenaltyLookupRegistrationTest {

    @Test
    void cleansSpacesAndDashesAndKeepsLettersAndDigits() {
        assertThat(PenaltyLookupController.cleanRegistration(" tst-123 ")).isEqualTo("tst123");
        assertThat(PenaltyLookupController.cleanRegistration("TST 123")).isEqualTo("TST123");
    }

    @Test
    void anythingElseIsTreatedAsNotGiven() {
        assertThat(PenaltyLookupController.cleanRegistration(null)).isNull();
        assertThat(PenaltyLookupController.cleanRegistration("   ")).isNull();
        assertThat(PenaltyLookupController.cleanRegistration("<script>")).isNull();
        assertThat(PenaltyLookupController.cleanRegistration("TOOLONGPLATE1")).isNull();
    }

    @Test
    void theRequestBodyNeverPrintsTheRegistration() {
        var body = new PenaltyLookupController.LookupBody("9000000004", LocalDate.of(2026, 1, 15), "TST123");
        assertThat(body.toString()).doesNotContain("TST123");
    }
}
