package cevoc.adapter.out.demo;

import cevoc.application.port.out.SignedLinkPort;
import cevoc.domain.ImageVariant;
import cevoc.domain.SignedLink;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Links for demo media, in front of the configured link maker. {@code demo/<number>/<file>} points at the demo media endpoint,
 * {@code samples/<path>} at the sample files the front end ships; any other key goes to the configured one unchanged.
 */
public final class DemoSignedLinks implements SignedLinkPort {

    static final String MEDIA_PATH = "/api/demo/media/";
    private final SignedLinkPort delegate;

    private DemoSignedLinks(SignedLinkPort delegate) {
        this.delegate = delegate;
    }

    public static SignedLinkPort wrapping(SignedLinkPort delegate) {
        return new DemoSignedLinks(delegate);
    }

    @Override
    public SignedLink linkFor(String objectKey, Duration validFor) {
        String own = own(objectKey);
        return own == null ? delegate.linkFor(objectKey, validFor) : new SignedLink(own, Instant.now().plus(validFor));
    }

    @Override
    public Optional<SignedLink> linkFor(String objectKey, ImageVariant variant, Duration validFor) {
        return own(objectKey) == null ? delegate.linkFor(objectKey, variant, validFor) : Optional.empty();
    }

    private static String own(String key) {
        if (key == null) {
            return null;
        }
        if (key.startsWith("demo/")) {
            return MEDIA_PATH + key.substring("demo/".length());
        }
        // Route sample videos through the demo media endpoint for server-side blur.
        // Static images still go direct.
        if (key.startsWith("samples/") && key.endsWith(".mp4")) {
            return MEDIA_PATH + "video/" + key.substring("samples/".length());
        }
        return key.startsWith("samples/") ? "/" + key : null;
    }
}
