package au.gov.nsw.transport.cevoc.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class StreamCauseTest {

    @Test
    void onlyFixedVocabularyTokensGoToTheBrowser() {
        assertThat(PenaltyLookupStreamController.whitelisted("timeout")).isEqualTo("timeout");
        assertThat(PenaltyLookupStreamController.whitelisted("plate-not-accepted")).isEqualTo("plate-not-accepted");
        assertThat(PenaltyLookupStreamController.whitelisted("Has A Space TST123")).isEqualTo("source-failed");
        assertThat(PenaltyLookupStreamController.whitelisted(null)).isEqualTo("source-failed");
    }
}
