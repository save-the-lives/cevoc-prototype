package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class HttpLegFallbackSourceTest {

    private static final CertificateQuery Q = CertificateQuery.aroundOffence("TEST-LOC-01", LocalDate.of(2026, 10, 30), LocalTime.NOON, null);

    private static CertificateSourcePort failing(String message) {
        return q -> {
            throw new ScrapeException(message);
        };
    }

    @Test
    void aRefusalOfTheHttpLegHandsOverToTheNextProviderInsteadOfStoppingTheChain() {
        CertificateSourcePort browser = q -> List.of();
        var chain = new CertificateProviderChain(List.of("http", "browser"),
                List.of(new HttpLegFallbackSource(failing("blocked-403")), browser));
        assertThat(chain.findCertificates(Q)).isEmpty();
    }

    @Test
    void theWrappedFailureIsNotARefusalAndNamesTheStatus() {
        assertThatThrownBy(() -> new HttpLegFallbackSource(failing("blocked-429")).findCertificates(Q))
                .hasMessage("http-leg-refused-429")
                .satisfies(e -> assertThat(CertificateProviderChain.isRefusal(e)).isFalse());
    }

    @Test
    void otherFailuresPassThroughUnchanged() {
        assertThatThrownBy(() -> new HttpLegFallbackSource(failing("no-search-form")).findCertificates(Q)).hasMessage("no-search-form");
    }

    @Test
    void aRefusalFromTheBrowserLegStillStopsTheChain() {
        var chain = new CertificateProviderChain(List.of("http", "browser"),
                List.of(new HttpLegFallbackSource(failing("blocked-403")), failing("blocked-403")));
        assertThatThrownBy(() -> chain.findCertificates(Q)).hasMessage("blocked-403");
    }
}
