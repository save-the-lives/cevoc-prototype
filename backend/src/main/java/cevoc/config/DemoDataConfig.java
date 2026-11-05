package cevoc.config;

import cevoc.adapter.in.web.DemoController;
import cevoc.adapter.out.demo.DemoCaseFactory;
import cevoc.adapter.out.demo.DemoCatalog;
import cevoc.adapter.out.demo.DemoPenaltyLookupAdapter;
import cevoc.adapter.out.demo.DemoRoute;
import cevoc.adapter.out.demo.SampleMediaSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * THE demo data switch. This is the only place that reads it: {@code cevoc.demo-data} (environment variable
 * CEVOC_DEMO_DATA), ON unless set to anything other than true. Everything demo is a bean of this class, so with the switch
 * off no demo adapter, hub endpoint or demo media exists and a demo number is an ordinary unknown notice. Other code asks
 * only "is there a demo adapter bean" (see {@link BeanConfig}), never the property. Turn it off before any real data or
 * real audience: set CEVOC_DEMO_DATA=false on the Container App (docs/DEMO-DATA.md).
 */
@Configuration
@ConditionalOnProperty(name = "cevoc.demo-data", havingValue = "true", matchIfMissing = true)
public class DemoDataConfig {

    @Bean
    DemoCaseFactory demoCaseFactory() {
        return new DemoCaseFactory(new SampleMediaSource());
    }

    @Bean
    DemoRoute demoRoute(DemoCaseFactory factory) {
        return new DemoRoute(new DemoPenaltyLookupAdapter(factory));
    }

    @Bean
    DemoCatalog demoCatalog(DemoCaseFactory factory) {
        return new DemoCatalog(factory);
    }

    @Bean
    DemoController demoController(DemoCatalog catalog) {
        return new DemoController(catalog, catalog);
    }
}
