package cevoc.adapter.out.revenuensw;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class RevenueNswHttpSettingsTest {

    private static RevenueNswHttpSettings with(String base, String prefix, String contact, String approval) {
        return new RevenueNswHttpSettings(base, prefix, contact, approval, "", "yyyy-MM-dd", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), 100, 1, Duration.ZERO, null);
    }

    @Test
    void offByDefault() {
        assertThat(RevenueNswHttpSettings.off().usable()).isFalse();
        assertThat(RevenueNswHttpFactory.settings(new MockEnvironment()).usable()).isFalse();
    }

    @Test
    void usableWithAnAllowedAddressAndAPath() {
        String b = "https://api.osr.nsw.gov.au";
        assertThat(with(b, "TEST_PREFIX_AAAA", "c@example.invalid", "ref").usable()).isTrue();
        assertThat(with("", "TEST_PREFIX_AAAA", "c@example.invalid", "ref").usable()).isFalse();
        assertThat(with(b, "", "c@example.invalid", "ref").usable()).isFalse();
        assertThat(with(b, "bad/prefix", "c@example.invalid", "ref").usable()).isFalse();
        // Contact and approval reference are optional (records 0029 and 0030).
        assertThat(with(b, "TEST_PREFIX_AAAA", "", "").usable()).isTrue();
        assertThat(with(b, "TEST_PREFIX_AAAA", "", "").userAgent()).isEqualTo("CEVOC/1.0");
        assertThat(with(b, "", "", "").withPathPrefix("TEST_PREFIX_AAAA").usable()).isTrue();
    }

    @Test
    void theBaseAddressDefaultsToTheApprovedHostButThePathStaysUnknown() {
        RevenueNswHttpSettings s = RevenueNswHttpFactory.settings(new MockEnvironment());
        assertThat(s.baseUrl()).isEqualTo("https://api.osr.nsw.gov.au");
        assertThat(s.usable()).isFalse();
        assertThat(s.withPathPrefix("TEST_PREFIX_AAAA").finesRoot()).isEqualTo("https://api.osr.nsw.gov.au/TEST_PREFIX_AAAA/rest/api/v2/fines");
    }

    @Test
    void onlyHttpsOnAnAllowedHostIsAccepted() {
        assertThat(with("http://api.osr.nsw.gov.au", "P", "c@example.invalid", "ref").usable()).isFalse();
        assertThat(with("https://other.example.invalid", "P", "c@example.invalid", "ref").usable()).isFalse();
        assertThat(with("https://user@api.osr.nsw.gov.au", "P", "c@example.invalid", "ref").usable()).isFalse();
        assertThat(with("https://api.osr.nsw.gov.au/", "P", "c@example.invalid", "ref").finesRoot())
                .isEqualTo("https://api.osr.nsw.gov.au/P/rest/api/v2/fines");
    }

    @Test
    void floorsAndLimitsAreEnforced() {
        RevenueNswHttpSettings s = new RevenueNswHttpSettings("https://api.osr.nsw.gov.au", "P", "c", "r", null, null, Duration.ofMillis(10),
                Duration.ofSeconds(1), Duration.ofSeconds(1), 100, 50, Duration.ZERO, Set.of());
        assertThat(s.minInterval()).isEqualTo(RevenueNswHttpSettings.MIN_INTERVAL_FLOOR);
        assertThat(s.summaryRetries()).isEqualTo(2);
        assertThat(s.offenceDateFormat()).isEqualTo("yyyy-MM-dd");
    }

    @Test
    void factoryReadsTheDocumentedProperties() {
        MockEnvironment env = new MockEnvironment()
                .withProperty("cevoc.revenue-nsw-http.base-url", "https://api.osr.nsw.gov.au")
                .withProperty("cevoc.revenue-nsw-http.path-prefix", "TEST_PREFIX_AAAA")
                .withProperty("cevoc.revenue-nsw-http.contact", "c@example.invalid")
                .withProperty("cevoc.revenue-nsw-http.approval-reference", "ref")
                .withProperty("cevoc.revenue-nsw-http.authorization-scheme", "Custom")
                .withProperty("cevoc.revenue-nsw-http.offence-date-format", "dd/MM/yyyy");
        RevenueNswHttpSettings s = RevenueNswHttpFactory.settings(env);
        assertThat(s.usable()).isTrue();
        assertThat(s.authorizationScheme()).isEqualTo("Custom");
        assertThat(s.offenceDateFormat()).isEqualTo("dd/MM/yyyy");
    }
}
