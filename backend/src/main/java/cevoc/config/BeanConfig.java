package cevoc.config;

import cevoc.adapter.out.azureblob.AzureBlobMediaAdapter;
import cevoc.adapter.out.azureblob.AzureCacheInvalidationAdapter;
import cevoc.adapter.out.ManifestFirstPenaltyLookupAdapter;
import cevoc.adapter.out.ManifestPenaltyLookupAdapter;
import cevoc.adapter.out.stub.StubMediaAdapter;
import cevoc.application.port.out.CacheInvalidationPort;
import cevoc.application.port.out.SignedLinkPort;
import cevoc.application.port.out.CertificateSourcePort;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import cevoc.application.port.in.LookupPenaltyUseCase;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.application.service.LookupPenaltyService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Composition root: the only place that picks which adapter fills each port. */
@Configuration
public class BeanConfig {

    /**
     * The lookup adapter, chosen by {@code cevoc.evidence.providers} (env {@code CEVOC_EVIDENCE_PROVIDERS}) when set,
     * otherwise by the legacy {@code cevoc.penalty-lookup.adapter} (see {@link LookupAdapterKind}).
     * <p>The new setting is an ordered comma-separated list: {@code http,browser} means try HTTP first, fall to browser
     * (the adaptive/circuit-breaker adapter). A single value like {@code browser} or {@code http} selects just that adapter.
     * <p>The legacy single-value setting still works when the new one is unset.
     */
    @Bean
    PenaltyLookupPort penaltyLookup(org.springframework.core.env.Environment env, cevoc.application.port.out.MediaStoragePort media,
            org.springframework.beans.factory.ObjectProvider<cevoc.application.port.out.BannerTextReaderPort> bannerReader) {
        EvidenceProviders.Result result = EvidenceProviders.resolve(env);
        java.util.List<String> ids = result.ids();

        // Single provider: direct selection (backward compatible).
        if (ids.size() == 1) {
            return switch (ids.get(0)) {
                case EvidenceProviders.STUB -> new ManifestFirstPenaltyLookupAdapter(new ManifestPenaltyLookupAdapter(), null, false);
                case EvidenceProviders.BROWSER -> cevoc.adapter.out.scraper.ScraperEvidenceFactory.create(env, media, bannerReader.getIfAvailable());
                case EvidenceProviders.HTTP -> cevoc.adapter.out.revenuensw.RevenueNswHttpFactory.create(env, media);
                case EvidenceProviders.ADAPTIVE -> new cevoc.adapter.out.revenuensw.AdaptivePenaltyLookupAdapter(
                        cevoc.adapter.out.revenuensw.RevenueNswHttpFactory.create(env, media),
                        cevoc.adapter.out.scraper.ScraperEvidenceFactory.create(env, media, bannerReader.getIfAvailable()));
                case EvidenceProviders.API -> throw new IllegalStateException("evidence provider api is not available yet (see docs/DIRECT-API-ROUTE.md)");
                default -> throw new IllegalStateException("unreachable: unknown evidence provider '" + ids.get(0) + "'");
            };
        }

        // Multiple providers: build the adaptive (circuit-breaker) adapter from the ordered list.
        // Currently the only multi-provider combination is http,browser (the adaptive adapter).
        boolean hasHttp = ids.contains(EvidenceProviders.HTTP);
        boolean hasBrowser = ids.contains(EvidenceProviders.BROWSER);
        if (hasHttp && hasBrowser) {
            return new cevoc.adapter.out.revenuensw.AdaptivePenaltyLookupAdapter(
                    cevoc.adapter.out.revenuensw.RevenueNswHttpFactory.create(env, media),
                    cevoc.adapter.out.scraper.ScraperEvidenceFactory.create(env, media, bannerReader.getIfAvailable()));
        }
        throw new IllegalStateException("unsupported evidence provider combination: " + ids
                + " (supported multi-provider lists: http,browser)");
    }

    /**
     * Reads the camera banner text out of the first evidence image (OCR, server side, Tesseract command line inside the image).
     * Always available: the scraper adapter uses it when active; other adapters ignore it. Demo data never uses it. See record 0019.
     */
    @Bean
    cevoc.application.port.out.BannerTextReaderPort bannerTextReader(
            @Value("${cevoc.banner-ocr.command:tesseract}") String command,
            @Value("${cevoc.banner-ocr.timeout-seconds:30}") long timeoutSeconds) {
        return new cevoc.adapter.out.ocr.TesseractBannerTextReader(command, java.time.Duration.ofSeconds(timeoutSeconds));
    }

    @Bean
    LookupPenaltyUseCase lookupPenaltyUseCase(PenaltyLookupPort port, SignedLinkPort signedLinks,
            org.springframework.beans.factory.ObjectProvider<CertificateSourcePort> certificates,
            org.springframework.beans.factory.ObjectProvider<cevoc.adapter.out.demo.DemoRoute> demo,
            @Value("${cevoc.scraper.certificates.window-margin-minutes:-1}") long windowMarginMinutes) {
        // Demo data (DemoDataConfig is the one place that switches it): a demo adapter bean exists only while it is on. It is
        // consulted first for demo numbers and gives the links for demo media; everything else is untouched.
        cevoc.adapter.out.demo.DemoRoute route = demo.getIfAvailable();
        cevoc.adapter.out.demo.DemoPenaltyLookupAdapter demoAdapter = route == null ? null : route.adapter();
        PenaltyLookupPort lookup = demoAdapter == null ? port : new cevoc.adapter.out.demo.DemoFirstPenaltyLookupAdapter(demoAdapter, port);
        SignedLinkPort links = demoAdapter == null ? signedLinks : cevoc.adapter.out.demo.DemoSignedLinks.wrapping(signedLinks);
        // Certificates: while demo data is on, a demo camera code is answered by the demo certificate source and any other code goes to
        // the configured provider (or finds nothing when none is configured). Demo off: the configured provider alone, as before.
        CertificateSourcePort configured = certificates.getIfAvailable();
        CertificateSourcePort certs = route == null ? configured
                : new cevoc.adapter.out.demo.DemoFirstCertificateSource(route.certificates(), configured);
        return new LookupPenaltyService(lookup, links, certs,
                windowMarginMinutes < 0 ? null : java.time.Duration.ofMinutes(windowMarginMinutes));
    }

    // The media adapter beans implement MediaStoragePort and SignedLinkPort (and for stub, CacheInvalidationPort) directly.
    // ---- media: cevoc.media.adapter = stub (default) | azure-blob ----

    // cevoc.media.adapter unset: "memory" when the lookup adapter is browser (the default; it captures real image bytes that the
    // stub would silently drop) or http (which stores real image bytes too), otherwise "stub".
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "'${cevoc.media.adapter:}' == 'stub' || ('${cevoc.media.adapter:}' == '' && !T(cevoc.config.LookupAdapterKind).evidenceProvidersKeepImageBytes('${cevoc.evidence.providers:}') && !T(cevoc.config.LookupAdapterKind).keepsImageBytes('${cevoc.penalty-lookup.adapter:}'))")
    StubMediaAdapter stubMedia(@Value("${cevoc.media.base-url:/samples}") String baseUrl) {
        return new StubMediaAdapter(baseUrl);
    }

    /**
     * Short-lived in-memory storage for captured images (no cloud, no disk): links are /api/media/&lt;token&gt; served by
     * the media endpoint. Retention and total size are bounded; a restart drops everything.
     */
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "'${cevoc.media.adapter:}' == 'memory' || ('${cevoc.media.adapter:}' == '' && (T(cevoc.config.LookupAdapterKind).evidenceProvidersKeepImageBytes('${cevoc.evidence.providers:}') || T(cevoc.config.LookupAdapterKind).keepsImageBytes('${cevoc.penalty-lookup.adapter:}')))")
    cevoc.adapter.out.memory.InMemoryMediaAdapter memoryMedia(
            @Value("${cevoc.media.public-base-url:}") String publicBaseUrl,
            @Value("${cevoc.media.memory.retention-minutes:20}") long retentionMinutes,
            @Value("${cevoc.media.memory.max-megabytes:96}") long maxMegabytes) {
        return new cevoc.adapter.out.memory.InMemoryMediaAdapter(publicBaseUrl,
                java.time.Duration.ofMinutes(retentionMinutes), maxMegabytes * 1024 * 1024, java.time.Clock.systemUTC());
    }

    @Bean
    @ConditionalOnProperty(name = "cevoc.media.adapter", havingValue = "azure-blob")
    AzureBlobMediaAdapter azureBlobMedia(
            @Value("${cevoc.media.azure.connection-string}") String connectionString,
            @Value("${cevoc.media.azure.container:evidence}") String container) {
        BlobContainerClient client = new BlobServiceClientBuilder().connectionString(connectionString)
                .buildClient().getBlobContainerClient(container);
        return new AzureBlobMediaAdapter(client);
    }

    @Bean
    @ConditionalOnProperty(name = "cevoc.media.adapter", havingValue = "azure-blob")
    CacheInvalidationPort azureCacheInvalidation() {
        return new AzureCacheInvalidationAdapter();
    }

    // ---- certificates: the certificates adapter choice is cevoc.certificates.providers (ordered list, same names as the lookup
    // adapter: http, browser, api). Empty or unset = the default, browser. The explicit value "none" means no certificate source.
    // See docs/DIRECT-API-ROUTE.md and docs/ARCHITECTURE.md. ----

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "!'${cevoc.certificates.providers:}'.trim().equalsIgnoreCase('none')")
    CertificateSourcePort certificateSource(org.springframework.core.env.Environment env) {
        return cevoc.adapter.out.scraper.CertificateProviders.create(env);
    }
}
