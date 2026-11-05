package cevoc.config;

import cevoc.adapter.out.azureblob.AzureBlobMediaAdapter;
import cevoc.adapter.out.azureblob.AzureCacheInvalidationAdapter;
import cevoc.adapter.out.ManifestFirstPenaltyLookupAdapter;
import cevoc.adapter.out.ManifestPenaltyLookupAdapter;
import cevoc.adapter.out.stub.StubMediaAdapter;
import cevoc.adapter.out.stub.StubPenaltyLookupAdapter;
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

    @Bean
    @ConditionalOnProperty(name = "cevoc.penalty-lookup.adapter", havingValue = "stub")
    PenaltyLookupPort stubPenaltyLookup() {
        return new StubPenaltyLookupAdapter();
    }

    /** Default. Manifest first; live source only when cevoc.scraper.enabled=true (no live adapter exists yet). */
    @Bean
    @ConditionalOnProperty(name = "cevoc.penalty-lookup.adapter", havingValue = "manifest", matchIfMissing = true)
    PenaltyLookupPort manifestFirstPenaltyLookup(@Value("${cevoc.scraper.enabled:false}") boolean scraperEnabled) {
        return new ManifestFirstPenaltyLookupAdapter(new ManifestPenaltyLookupAdapter(), null, scraperEnabled);
    }

    // Prototype scraper: never the default. Also needs cevoc.scraper.evidence.enabled=true; see docs/ARCHITECTURE.md.
    @Bean
    @ConditionalOnProperty(name = "cevoc.penalty-lookup.adapter", havingValue = "scraper-evidence")
    PenaltyLookupPort scraperEvidenceLookup(org.springframework.core.env.Environment env, cevoc.application.port.out.MediaStoragePort media) {
        return cevoc.adapter.out.scraper.ScraperEvidenceFactory.create(env, media);
    }

    // Plain HTTP route to the Revenue NSW JSON service (no browser): never the default. Also needs
    // cevoc.revenue-nsw-http.enabled=true, base-url, path-prefix, contact and approval-reference; see docs/ARCHITECTURE.md.
    @Bean
    @ConditionalOnProperty(name = "cevoc.penalty-lookup.adapter", havingValue = "revenue-nsw-http")
    PenaltyLookupPort revenueNswHttpLookup(org.springframework.core.env.Environment env, cevoc.application.port.out.MediaStoragePort media) {
        return cevoc.adapter.out.revenuensw.RevenueNswHttpFactory.create(env, media);
    }

    @Bean
    LookupPenaltyUseCase lookupPenaltyUseCase(PenaltyLookupPort port, SignedLinkPort signedLinks,
            org.springframework.beans.factory.ObjectProvider<CertificateSourcePort> certificates,
            @Value("${cevoc.scraper.certificates.window-margin-minutes:-1}") long windowMarginMinutes) {
        return new LookupPenaltyService(port, signedLinks, certificates.getIfAvailable(),
                windowMarginMinutes < 0 ? null : java.time.Duration.ofMinutes(windowMarginMinutes));
    }

    // The media adapter beans implement MediaStoragePort and SignedLinkPort (and for stub, CacheInvalidationPort) directly.
    // ---- media: cevoc.media.adapter = stub (default) | azure-blob ----

    // cevoc.media.adapter unset: "memory" when the live evidence scraper is the lookup adapter (it captures real image bytes
    // that the stub would silently drop) or "revenue-nsw-http" (which stores real image bytes too), otherwise "stub".
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "'${cevoc.media.adapter:}' == 'stub' || ('${cevoc.media.adapter:}' == '' && '${cevoc.penalty-lookup.adapter:manifest}' != 'scraper-evidence' && '${cevoc.penalty-lookup.adapter:manifest}' != 'revenue-nsw-http')")
    StubMediaAdapter stubMedia(@Value("${cevoc.media.base-url:/samples}") String baseUrl) {
        return new StubMediaAdapter(baseUrl);
    }

    /**
     * Short-lived in-memory storage for captured images (no cloud, no disk): links are /api/media/&lt;token&gt; served by
     * the media endpoint. Retention and total size are bounded; a restart drops everything.
     */
    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "'${cevoc.media.adapter:}' == 'memory' || ('${cevoc.media.adapter:}' == '' && ('${cevoc.penalty-lookup.adapter:manifest}' == 'scraper-evidence' || '${cevoc.penalty-lookup.adapter:manifest}' == 'revenue-nsw-http'))")
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

    // ---- certificates: INERT unless cevoc.certificates.providers (ordered) is set, or the legacy
    // cevoc.scraper.certificates.enabled=true. Providers: search-page (interim), tfnsw-api (later), http-form, browser-link.
    // See docs/DIRECT-API-ROUTE.md and docs/ARCHITECTURE.md. ----

    @Bean
    @org.springframework.boot.autoconfigure.condition.ConditionalOnExpression(
            "!('${cevoc.certificates.providers:}'.trim().isEmpty()) || ${cevoc.scraper.certificates.enabled:false}")
    CertificateSourcePort certificateSource(org.springframework.core.env.Environment env) {
        return cevoc.adapter.out.scraper.CertificateProviders.create(env);
    }
}
