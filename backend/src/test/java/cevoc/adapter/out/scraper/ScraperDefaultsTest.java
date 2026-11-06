package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.config.LookupAdapterKind;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

/** The defaults: real adapters unless stub is chosen, fully qualified default addresses, and a blank contact never crashes. */
class ScraperDefaultsTest {

    @Test
    void unsetAndBlankMeanTheBrowserAdapter() {
        assertThat(LookupAdapterKind.of(null)).isEqualTo(LookupAdapterKind.BROWSER);
        assertThat(LookupAdapterKind.of("")).isEqualTo(LookupAdapterKind.BROWSER);
        assertThat(LookupAdapterKind.of("   ")).isEqualTo(LookupAdapterKind.BROWSER);
        assertThat(LookupAdapterKind.of("Browser")).isEqualTo(LookupAdapterKind.BROWSER);
    }

    @Test
    void stubIsAnExplicitChoiceAndUnknownValuesStillFallBackToStub() {
        assertThat(LookupAdapterKind.of("stub")).isEqualTo(LookupAdapterKind.STUB);
        assertThat(LookupAdapterKind.of("manifest")).isEqualTo(LookupAdapterKind.STUB);
        assertThat(LookupAdapterKind.of("scraper-evidence")).isEqualTo(LookupAdapterKind.STUB);
    }

    @Test
    void mediaKeepsImageBytesForTheDefaultAndNotForStubOrUnknown() {
        assertThat(LookupAdapterKind.keepsImageBytes(null)).isTrue();
        assertThat(LookupAdapterKind.keepsImageBytes("")).isTrue();
        assertThat(LookupAdapterKind.keepsImageBytes("browser")).isTrue();
        assertThat(LookupAdapterKind.keepsImageBytes(" HTTP ")).isTrue();
        assertThat(LookupAdapterKind.keepsImageBytes("stub")).isFalse();
        assertThat(LookupAdapterKind.keepsImageBytes("nonsense")).isFalse();
    }

    @Test
    void theEvidenceAddressDefaultsToAFullyQualifiedHttpsUrlWhenUnsetOrBlank() {
        assertThat(ScraperSettings.DEFAULT_URL).startsWith("https://www.apps09.revenue.nsw.gov.au/customer_service/finesonline");
        assertThat(ScraperEvidenceFactory.settings(new MockEnvironment()).url()).isEqualTo(ScraperSettings.DEFAULT_URL);
        assertThat(ScraperEvidenceFactory.settings(new MockEnvironment().withProperty("cevoc.scraper.evidence.url", "  ")).url())
                .isEqualTo(ScraperSettings.DEFAULT_URL);
        assertThat(ScraperEvidenceFactory.settings(new MockEnvironment().withProperty("cevoc.scraper.evidence.url", "https://other.example.invalid/x")).url())
                .isEqualTo("https://other.example.invalid/x");
    }

    @Test
    void theCertificatesPageDefaultIsFullyQualified() {
        assertThat(SearchPageCertificateSource.DEFAULT_PAGE_URL)
                .isEqualTo("https://cevoc.transport.nsw.gov.au/cevoc/pages/sdro/searchCertificates.jsf");
    }

    @Test
    void theContactHasNoDefaultAndABlankOneKeepsTheRouteOffWithoutCrashing() {
        MockEnvironment env = new MockEnvironment();
        assertThat(ScraperEvidenceFactory.settings(env).contact()).isEmpty();
        assertThat(ScraperEvidenceFactory.settings(env).usable()).isFalse();
        PenaltyLookupPort port = ScraperEvidenceFactory.create(env, null);
        assertThat(port.find(new PenaltyLookupRequest("9555555555", LocalDate.of(2026, 1, 15))).status())
                .isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
        // With a contact the default address is enough to be usable.
        assertThat(ScraperEvidenceFactory.settings(env.withProperty("cevoc.scraper.evidence.contact", "test-contact@example.invalid")).usable())
                .isTrue();
    }
}
