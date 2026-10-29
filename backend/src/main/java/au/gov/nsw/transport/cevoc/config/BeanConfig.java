package au.gov.nsw.transport.cevoc.config;

import au.gov.nsw.transport.cevoc.adapter.out.stub.StubPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.application.port.in.LookupPenaltyUseCase;
import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.application.service.LookupPenaltyService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Composition root: the only place that picks which adapter fills each port. */
@Configuration
public class BeanConfig {

    @Bean
    @ConditionalOnProperty(name = "cevoc.penalty-lookup.adapter", havingValue = "stub", matchIfMissing = true)
    PenaltyLookupPort stubPenaltyLookup() {
        return new StubPenaltyLookupAdapter();
    }

    @Bean
    LookupPenaltyUseCase lookupPenaltyUseCase(PenaltyLookupPort port) {
        return new LookupPenaltyService(port);
    }
}
