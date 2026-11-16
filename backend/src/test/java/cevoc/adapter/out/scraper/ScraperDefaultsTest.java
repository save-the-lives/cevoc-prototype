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
    void theContactIsOptionalAndOnlyAddsToTheUserAgent() {
        MockEnvironment env = new MockEnvironment();
        assertThat(ScraperEvidenceFactory.settings(env).contact()).isEmpty();
        // No contact: the default address alone makes the route usable, and the User-Agent carries no contact.
        assertThat(ScraperEvidenceFactory.settings(env).usable()).isTrue();
        assertThat(ScraperEvidenceFactory.settings(env).userAgent()).isEqualTo("CEVOC/1.0");
        // Default build has no browser installed, so a lookup answers "not available" and makes no network call.
        PenaltyLookupPort port = ScraperEvidenceFactory.create(env, null);
        assertThat(port.find(new PenaltyLookupRequest("9555555555", LocalDate.of(2026, 1, 15))).status())
                .isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);
        assertThat(ScraperEvidenceFactory.settings(env.withProperty("cevoc.scraper.evidence.contact", "test-contact@example.invalid")).userAgent())
                .isEqualTo("CEVOC/1.0 (contact: test-contact@example.invalid)");
    }
}
