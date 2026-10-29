package au.gov.nsw.transport.cevoc.config;

import au.gov.nsw.transport.cevoc.adapter.out.azureblob.AzureBlobMediaAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.azureblob.AzureCacheInvalidationAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubMediaAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.application.port.out.CacheInvalidationPort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.BlobServiceClientBuilder;
import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import au.gov.nsw.transport.cevoc.application.port.out.EvidenceSourcePort;
import au.gov.nsw.transport.cevoc.application.service.LayeredPenaltyLookup;
import org.springframework.beans.factory.ObjectProvider;
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
    @ConditionalOnProperty(name = "cevoc.penalty-lookup.adapter", havingValue = "stub", matchIfMissing = true)
    StubPenaltyLookupAdapter stubPenaltyLookup() {
        return new StubPenaltyLookupAdapter();
    }

    /** Manifest/stub first; live sources only if a scraper adapter bean exists (none by default). */
    @Bean
    PenaltyLookupPort penaltyLookup(StubPenaltyLookupAdapter manifest,
                                    ObjectProvider<EvidenceSourcePort> evidence,
                                    ObjectProvider<CertificateSourcePort> certificates) {
        return new LayeredPenaltyLookup(manifest, evidence.getIfAvailable(), certificates.getIfAvailable());
    }

    @Bean
    LookupPenaltyUseCase lookupPenaltyUseCase(PenaltyLookupPort port, SignedLinkPort signedLinks) {
        return new LookupPenaltyService(port, signedLinks);
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
}
