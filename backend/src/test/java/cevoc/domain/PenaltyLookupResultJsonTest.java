package cevoc.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class PenaltyLookupResultJsonTest {

    @Test
    void cameraCodeIsInternalAndNeverInTheJsonResponse() throws Exception {
        PenaltyLookupResult r = new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "9000000099", "x", null, List.of(), "TEST", "TST001");
        assertThat(r.cameraCode()).isEqualTo("TST001");
        JsonNode json = new ObjectMapper().valueToTree(r);
        assertThat(json.has("cameraCode")).isFalse();
        assertThat(json.has("status")).isTrue();
        assertThat(new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "n", "x", null, List.of(), "TEST").cameraCode()).isNull();
    }

    @Test
    void detailsTravelInTheJsonWhenPresentAndAreOmittedWhenEmpty() {
        PenaltyLookupResult base = new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "9000000099", "x", null, List.of(), "TEST", "TST001");
        assertThat(new ObjectMapper().valueToTree(base).has("details")).isFalse();
        PenaltyLookupResult with = base.withDetails(java.util.Map.of("timeSinceRed", "1.2 sec", "lane", "2"));
        JsonNode json = new ObjectMapper().valueToTree(with);
        assertThat(json.get("details").get("timeSinceRed").asText()).isEqualTo("1.2 sec");
        assertThat(json.has("cameraCode")).isFalse();
        assertThat(with.withEvidence(List.of()).details()).containsEntry("lane", "2");
        assertThat(with.withPlateRequired(true).details()).containsEntry("lane", "2");
    }
}
