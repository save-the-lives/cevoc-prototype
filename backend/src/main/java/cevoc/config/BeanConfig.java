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
     * The lookup adapter, chosen by the ONE setting cevoc.penalty-lookup.adapter (see {@link LookupAdapterKind}):
     * stub (default; bundled fictitious data, nothing contacted), browser (Chromium), http (plain request), api (reserved).
     * There are no per-route on/off switches: a route that is not selected does not exist.
     */
    @Bean
    PenaltyLookupPort penaltyLookup(org.springframework.core.env.Environment env, cevoc.application.port.out.MediaStoragePort media,
            org.springframework.beans.factory.ObjectProvider<cevoc.application.port.out.BannerTextReaderPort> bannerReader) {
        return switch (LookupAdapterKind.of(env.getProperty(LookupAdapterKind.PROPERTY, ""))) {
            case STUB -> new ManifestFirstPenaltyLookupAdapter(new ManifestPenaltyLookupAdapter(), null, false);
            case BROWSER -> cevoc.adapter.out.scraper.ScraperEvidenceFactory.create(env, media, bannerReader.getIfAvailable());
            case HTTP -> cevoc.adapter.out.revenuensw.RevenueNswHttpFactory.create(env, media);
            case API -> throw new IllegalStateException("cevoc.penalty-lookup.adapter=api is not available yet (see docs/DIRECT-API-ROUTE.md)");
        };
    }

    /**
     * Reads the camera banner text out of the first evidence image (OCR, server side, Tesseract command line inside the image).
     * Off unless cevoc.banner-ocr.enabled=true (env CEVOC_BANNER_OCR_ENABLED). Demo data never uses it. See record 0019.
     */
    @Bean
    @ConditionalOnProperty(name = "cevoc.banner-ocr.enabled", havingValue = "true")
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
        return new LookupPenaltyService(lookup, links, certificates.getIfAvailable(),
                windowMarginMinutes < 0 ? null : java.time.Duration.ofMinutes(windowMarginMinutes));
    }

    // The media adapter beans implement MediaStoragePort and SignedLinkPort (and for stub, CacheInvalidationPort) directly.
    // ---- media: cevoc.media.adapter = stub (default) | azure-blob ----

    // cevoc.media.adapter unset: "memory" when the lookup adapter is browser (it captures real image bytes that the stub would
    // silently drop) or http (which stores real image bytes too), otherwise "stub".
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "'${cevoc.media.adapter:}' == 'stub' || ('${cevoc.media.adapter:}' == '' && '${cevoc.penalty-lookup.adapter:}'.trim().toLowerCase() != 'browser' && '${cevoc.penalty-lookup.adapter:}'.trim().toLowerCase() != 'http')")
    StubMediaAdapter stubMedia(@Value("${cevoc.media.base-url:/samples}") String baseUrl) {
        return new StubMediaAdapter(baseUrl);
    }

    /**
     * Short-lived in-memory storage for captured images (no cloud, no disk): links are /api/media/&lt;token&gt; served by
     * the media endpoint. Retention and total size are bounded; a restart drops everything.
     */
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "'${cevoc.media.adapter:}' == 'memory' || ('${cevoc.media.adapter:}' == '' && ('${cevoc.penalty-lookup.adapter:}'.trim().toLowerCase() == 'browser' || '${cevoc.penalty-lookup.adapter:}'.trim().toLowerCase() == 'http'))")
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
    // adapter: http, browser, api). INERT (no certificate source) while the list is empty, which is the default.
    // See docs/DIRECT-API-ROUTE.md and docs/ARCHITECTURE.md. ----

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "!('${cevoc.certificates.providers:}'.trim().isEmpty())")
    CertificateSourcePort certificateSource(org.springframework.core.env.Environment env) {
        return cevoc.adapter.out.scraper.CertificateProviders.create(env);
    }
}
