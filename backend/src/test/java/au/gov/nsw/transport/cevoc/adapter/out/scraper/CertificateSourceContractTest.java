package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.domain.CertificateMatch;
import au.gov.nsw.transport.cevoc.domain.CertificateQuery;
import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * The contract every certificate provider must meet, run against FICTITIOUS fixtures only (no network, no browser):
 * the same results page gives the same five rows in page order, the covering rows are marked, a page with no results
 * gives an empty list. Each provider (search-page, http-form, browser-link) and the provider chain extends this.
 */
abstract class CertificateSourceContractTest {

    static final LocalDateTime OFFENCE_AT = LocalDateTime.of(2026, 10, 30, 11, 12, 13);
    static final CertificateQuery QUERY = CertificateQuery.ofLocation("TEST-LOC-01",
            LocalDateTime.of(2026, 10, 30, 0, 0), LocalDateTime.of(2026, 10, 30, 23, 59));

    /** A provider that is served {@code resultsPage} (a fictitious rendered or fetched results page) by its fake source. */
    abstract CertificateSourcePort providerServing(String resultsPage);

    @AfterEach
    void cleanUp() {
        CertificateHandoff.clear();
        LookupDiagnostic.clear();
    }

    @Test
    void returnsEveryRowInPageOrderWithTheFiveKnownColumns() {
        List<CertificateRef> rows = providerServing(CertificatePageParserTest.fixture("results-certificates.html")).findCertificates(QUERY);
        assertThat(rows).hasSize(5);
        CertificateRef first = rows.get(0);
        assertThat(first.description()).isEqualTo("TEST camera certificate A");
        assertThat(first.type()).isEqualTo("Camera");
        assertThat(first.periodFrom()).isEqualTo(LocalDateTime.of(2026, 7, 1, 0, 0));
        assertThat(first.periodTo()).isEqualTo(LocalDateTime.of(2026, 12, 31, 23, 59));
        assertThat(first.certifiedDate()).isEqualTo(LocalDateTime.of(2026, 7, 2, 9, 30));
        assertThat(first.expiryDate()).isEqualTo(LocalDateTime.of(2027, 12, 31, 0, 0));
        assertThat(rows.get(4).periodFrom()).isNull();
    }

    @Test
    void marksTheRowsWhosePeriodCoversTheOffenceAndDropsNone() {
        CertificateSourcePort port = providerServing(CertificatePageParserTest.fixture("results-certificates.html"));
        List<CertificateMatch> marked = port.findCertificatesCovering(QUERY, OFFENCE_AT);
        assertThat(marked).hasSize(5);
        assertThat(marked.stream().filter(CertificateMatch::covering).count()).isEqualTo(2);
    }

    @Test
    void aPageWithNoResultsGivesAnEmptyListNotAnError() {
        assertThat(providerServing(CertificatePageParserTest.fixture("no-results.html")).findCertificates(QUERY)).isEmpty();
    }
}

// ---- the providers (each one runs the contract above) ----

/** search-page: a browser session of its own, served by the fake session. */
class SearchPageContractTest extends CertificateSourceContractTest {
    @Override
    CertificateSourcePort providerServing(String resultsPage) {
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.searchHtml = resultsPage;
        return new SearchPageCertificateSource(new ScraperEvidenceTest.Sessions(fake), "https://search.example.invalid/searchCertificates.jsf",
                new CertificatePageParser(), Duration.ofMinutes(5), Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC));
    }
}

/** http-form: the plain HTTP form scraper, served by a fake fetcher. */
class HttpFormContractTest extends CertificateSourceContractTest {
    @Override
    CertificateSourcePort providerServing(String resultsPage) {
        var props = new CertificateScraperProperties("https://example.invalid/page.jsf", "test-agent", Duration.ofSeconds(5),
                Duration.ofSeconds(5), Duration.ofSeconds(10), Duration.ofMinutes(5), CertificateKeyStrategy.VIA_ENFORCEMENT_SITE);
        return new CertificateScraperAdapter(new CertificateScraperAdapterTest.FakeFetcher(resultsPage), new CertificatePageParser(), props,
                Clock.fixed(Instant.parse("2030-01-01T00:00:00Z"), ZoneOffset.UTC));
    }
}

/** browser-link (legacy): parses the page the evidence step handed over. */
class BrowserLinkContractTest extends CertificateSourceContractTest {
    @Override
    CertificateSourcePort providerServing(String resultsPage) {
        CertificateSourcePort real = new BrowserCertificateSourceAdapter(new CertificatePageParser());
        return new CertificateSourcePort() {
            @Override
            public List<CertificateRef> findCertificates(CertificateQuery query) {
                CertificateHandoff.put(resultsPage);
                return real.findCertificates(query);
            }
        };
    }
}

/** The chain: a failing first provider hands over to the search page. */
class ChainContractTest extends CertificateSourceContractTest {
    @Override
    CertificateSourcePort providerServing(String resultsPage) {
        CertificateSourcePort failing = new CertificateSourcePort() {
            @Override
            public List<CertificateRef> findCertificates(CertificateQuery query) {
                throw new ScrapeException("provider not available");
            }
        };
        return new CertificateProviderChain(List.of(failing, new SearchPageContractTest().providerServing(resultsPage)));
    }
}
