package au.gov.nsw.transport.cevoc.adapter.out.azureblob;

import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import au.gov.nsw.transport.cevoc.domain.SignedLink;
import com.azure.storage.blob.BlobClient;
import com.azure.storage.blob.BlobContainerClient;
import com.azure.storage.blob.models.BlobHttpHeaders;
import com.azure.storage.blob.sas.BlobSasPermission;
import com.azure.storage.blob.sas.BlobServiceSasSignatureValues;
import java.io.InputStream;
import java.time.Duration;
import java.time.OffsetDateTime;

/**
 * Azure Blob Storage adapter. Links are read-only SAS URLs that expire after the requested time.
 * Azure-specific: nothing outside adapter.out.azureblob may reference com.azure.
 */
public class AzureBlobMediaAdapter implements MediaStoragePort, SignedLinkPort {

    private final BlobContainerClient container;

    public AzureBlobMediaAdapter(BlobContainerClient container) {
        this.container = container;
    }

    @Override
    public void store(String objectKey, String contentType, InputStream content, long contentLength) {
        BlobClient blob = container.getBlobClient(safe(objectKey));
        blob.upload(content, contentLength, true);
        blob.setHttpHeaders(new BlobHttpHeaders().setContentType(contentType));
    }

    @Override
    public boolean exists(String objectKey) {
        return container.getBlobClient(safe(objectKey)).exists();
    }

    @Override
    public SignedLink linkFor(String objectKey, Duration validFor) {
        BlobClient blob = container.getBlobClient(safe(objectKey));
        OffsetDateTime expiry = OffsetDateTime.now().plus(validFor);
        BlobServiceSasSignatureValues values =
                new BlobServiceSasSignatureValues(expiry, new BlobSasPermission().setReadPermission(true));
        String sas = blob.generateSas(values);
        return new SignedLink(blob.getBlobUrl() + "?" + sas, expiry.toInstant());
    }

    private static String safe(String key) {
        if (key == null || key.isBlank() || key.contains("..") || key.startsWith("/")) {
            throw new IllegalArgumentException("Invalid object key");
        }
        return key;
    }
}
