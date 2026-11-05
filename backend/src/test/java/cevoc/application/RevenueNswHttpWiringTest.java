package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.ManifestFirstPenaltyLookupAdapter;
import cevoc.adapter.out.memory.InMemoryMediaAdapter;
import cevoc.adapter.out.revenuensw.RevenueNswHttpLookupAdapter;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import java.time.LocalDate;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

/** Adapter selection by configuration. The new route is never the default and, selected but not enabled, makes no call. */
class RevenueNswHttpWiringTest {

    @Nested
    @SpringBootTest
    class DefaultStaysAsItWas {
        @Autowired ApplicationContext ctx;

        @Test
        void manifestFirstIsStillTheDefaultAndNoHttpRouteExists() {
            assertThat(ctx.getBean(PenaltyLookupPort.class)).isInstanceOf(ManifestFirstPenaltyLookupAdapter.class);
            assertThat(ctx.getBeansOfType(RevenueNswHttpLookupAdapter.class)).isEmpty();
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter=revenue-nsw-http")
    class SelectedButNotEnabled {
        @Autowired ApplicationContext ctx;
        @Autowired PenaltyLookupPort port;

        @Test
        void isChosenByConfigurationUsesInMemoryMediaAndReportsSwitchedOff() {
            assertThat(port).isInstanceOf(RevenueNswHttpLookupAdapter.class);
            assertThat(ctx.getBeansOfType(InMemoryMediaAdapter.class)).hasSize(1);
            PenaltyLookupResult r = port.find(new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15)));
            assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.LIVE_LOOKUP_OFF);
        }
    }

    @Nested
    @SpringBootTest(properties = "cevoc.penalty-lookup.adapter=scraper-evidence")
    class ChromiumRouteUnchanged {
        @Autowired ApplicationContext ctx;

        @Test
        void chromiumSelectionDoesNotCreateTheHttpRoute() {
            assertThat(ctx.getBeansOfType(RevenueNswHttpLookupAdapter.class)).isEmpty();
        }
    }
}
