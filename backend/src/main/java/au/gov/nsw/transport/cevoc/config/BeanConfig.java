package au.gov.nsw.transport.cevoc.config;

import au.gov.nsw.transport.cevoc.adapter.out.azureblob.AzureBlobMediaAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.azureblob.AzureCacheInvalidationAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.ManifestFirstPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.ManifestPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubMediaAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.application.port.out.CacheInvalidationPort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import org.springframework.beans.factory.annotation.Value;
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
    PenaltyLookupPort scraperEvidenceLookup(org.springframework.core.env.Environment env, au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort media) {
        return au.gov.nsw.transport.cevoc.adapter.out.scraper.ScraperEvidenceFactory.create(env, media);
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

    @Bean
    @ConditionalOnProperty(name = "cevoc.media.adapter", havingValue = "stub", matchIfMissing = true)
    StubMediaAdapter stubMedia(@Value("${cevoc.media.base-url:/samples}") String baseUrl) {
        return new StubMediaAdapter(baseUrl);
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
        return au.gov.nsw.transport.cevoc.adapter.out.scraper.CertificateProviders.create(env);
    }
}
