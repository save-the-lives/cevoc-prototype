package au.gov.nsw.transport.cevoc.adapter.out;

import au.gov.nsw.transport.cevoc.application.port.out.EnforcementSiteResolver;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.io.ClassPathResource;

/**
 * Stub resolver (fictitious data only). Maps the penalty page's location text (NoticeDetails.location) to a certificate
 * page location code using manifest.json: each notice's optional {@code locationCode} is keyed by its notice
 * {@code location} text. Matching ignores case and repeated spaces. Offence date/time are available for a future
 * resolver (a site may change code over time) but are not needed by this stub.
 */
public class ManifestEnforcementSiteResolver implements EnforcementSiteResolver {

    private final Map<String, String> byLocationText = new HashMap<>();

    public ManifestEnforcementSiteResolver() {
        this("manifest.json");
    }

    public ManifestEnforcementSiteResolver(String classpathResource) {
        try (InputStream in = new ClassPathResource(classpathResource).getInputStream()) {
            for (JsonNode n : new ObjectMapper().readTree(in).path("notices")) {
                String code = n.path("locationCode").asText("");
                String text = n.path("notice").path("location").asText("");
                if (!code.isBlank() && !text.isBlank()) byLocationText.put(normalise(text), code);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + classpathResource, e);
        }
    }

    @Override
    public Optional<String> locationCodeFor(NoticeDetails notice) {
        if (notice == null || notice.location() == null) return Optional.empty();
        return Optional.ofNullable(byLocationText.get(normalise(notice.location())));
    }

    private static String normalise(String s) {
        return s.trim().replaceAll("\\s+", " ").toUpperCase(Locale.ROOT);
    }
}
