package cevoc.config;

import cevoc.adapter.in.web.DemoRoutes;
import cevoc.adapter.out.demo.DemoCaseFactory;
import cevoc.adapter.out.demo.DemoContentGate;
import cevoc.adapter.out.httpbundle.HttpsDemoBundleSource;
import cevoc.application.port.out.DemoBundleSourcePort;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import cevoc.adapter.out.demo.DemoCatalog;
import cevoc.adapter.out.demo.DemoPenaltyLookupAdapter;
import cevoc.adapter.out.demo.DemoRoute;
import cevoc.adapter.out.demo.SampleMediaSource;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.ServerResponse;

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

    /**
     * Where the demo media comes from (decision record 0018). No bundle URL: the built-in sample content. A URL: the bundle,
     * fetched lazily by plain HTTPS and verified against the configured version and checksum; if that fails demo content is
     * unavailable (not a crash). The location is only configuration; nothing here knows the host.
     */
    @Bean
    DemoCaseFactory demoCaseFactory(@Value("${cevoc.demo-bundle.url:}") String bundleUrl,
            @Value("${cevoc.demo-bundle.version:}") String bundleVersion,
            @Value("${cevoc.demo-bundle.sha256:}") String bundleSha256,
            @Value("${cevoc.demo-bundle.timeout-seconds:60}") long timeoutSeconds,
            @Value("${cevoc.demo-bundle.retry-minutes:10}") long retryMinutes) {
        DemoBundleSourcePort source = new HttpsDemoBundleSource(Duration.ofSeconds(Math.max(5, timeoutSeconds)));
        return new DemoCaseFactory(new DemoContentGate(source, bundleUrl, bundleVersion, bundleSha256, new SampleMediaSource(),
                System::currentTimeMillis, Duration.ofMinutes(Math.max(1, retryMinutes)).toMillis()));
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
    RouterFunction<ServerResponse> demoRoutes(DemoCatalog catalog) {
        return DemoRoutes.routes(catalog, catalog);
    }
}
