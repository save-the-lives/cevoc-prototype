package au.gov.nsw.transport.cevoc.config;

import java.util.Arrays;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Lets the separately hosted front end call the API from the browser.
 * Origins come from cevoc.cors.allowed-origins (comma separated; env var CEVOC_CORS_ALLOWED_ORIGINS).
 * Empty means no cross-origin access. The API is read-only lookups with no cookies or login.
 */
@Configuration
public class CorsConfig implements WebMvcConfigurer {

    private final String[] allowedOrigins;

    public CorsConfig(@Value("${cevoc.cors.allowed-origins:}") String origins) {
        this.allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim).filter(s -> !s.isEmpty()).toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        if (allowedOrigins.length == 0) return;
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("Content-Type")
                .maxAge(3600);
        // Owner-run live check (only answers when cevoc.live-check.enabled=true and a token is set; token guard in livecheck.LiveCheckGuard).
        registry.addMapping("/live-check/**")
                .allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "OPTIONS")
                .allowedHeaders("Content-Type", "X-Live-Check-Token")
                .maxAge(3600);
    }
}
