package au.gov.nsw.transport.cevoc.config;

import au.gov.nsw.transport.cevoc.adapter.out.azureblob.AzureBlobMediaAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.azureblob.AzureCacheInvalidationAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.ManifestFirstPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.ManifestPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubMediaAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.stub.StubPenaltyLookupAdapter;
import au.gov.nsw.transport.cevoc.application.port.out.CacheInvalidationPort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.CertificateKeyStrategy;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.CertificatePageParser;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.CertificateScraperAdapter;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.CertificateScraperProperties;
import au.gov.nsw.transport.cevoc.adapter.out.scraper.PoliteHttpFetcher;
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

    // ---- certificate scraper: INERT unless cevoc.scraper.certificates.enabled=true (see docs/ARCHITECTURE.md) ----

    @Bean
    @ConditionalOnProperty(name = "cevoc.scraper.certificates.enabled", havingValue = "true")
    CertificateSourcePort certificateScraper(
            @Value("${cevoc.scraper.certificates.approval-reference:}") String approvalReference,
            @Value("${cevoc.scraper.certificates.page-url:" + CertificateScraperProperties.DEFAULT_PAGE_URL + "}") String pageUrl,
            @Value("${cevoc.scraper.certificates.user-agent:" + CertificateScraperProperties.DEFAULT_USER_AGENT + "}") String userAgent,
            @Value("${cevoc.scraper.certificates.min-interval-ms:5000}") long minIntervalMs,
            @Value("${cevoc.scraper.certificates.connect-timeout-ms:5000}") long connectTimeoutMs,
            @Value("${cevoc.scraper.certificates.request-timeout-ms:10000}") long requestTimeoutMs,
            @Value("${cevoc.scraper.certificates.cache-ttl-seconds:300}") long cacheTtlSeconds,
            @Value("${cevoc.scraper.certificates.key-strategy:VIA_ENFORCEMENT_SITE}") CertificateKeyStrategy keyStrategy,
            @Value("${cevoc.scraper.certificates.window-margin-minutes:-1}") long windowMarginMinutes) {
        if (approvalReference.isBlank()) {
            throw new IllegalStateException("cevoc.scraper.certificates.approval-reference is required: "
                    + "the source's robots.txt disallows automated access, so record the owner's approval reference first");
        }
        CertificateScraperProperties props = new CertificateScraperProperties(pageUrl, userAgent,
                java.time.Duration.ofMillis(minIntervalMs), java.time.Duration.ofMillis(connectTimeoutMs),
                java.time.Duration.ofMillis(requestTimeoutMs), java.time.Duration.ofSeconds(cacheTtlSeconds), keyStrategy,
                windowMarginMinutes < 0 ? null : java.time.Duration.ofMinutes(windowMarginMinutes));
        return new CertificateScraperAdapter(new PoliteHttpFetcher(props), new CertificatePageParser(), props,
                java.time.Clock.systemUTC());
    }
}
