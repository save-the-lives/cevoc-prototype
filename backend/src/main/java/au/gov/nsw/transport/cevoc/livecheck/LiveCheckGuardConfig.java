package au.gov.nsw.transport.cevoc.livecheck;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Puts the token guard in front of /live-check/**. Absent unless cevoc.live-check.enabled=true (env CEVOC_LIVECHECK_ENABLED). */
@Configuration
@ConditionalOnProperty(name = "cevoc.live-check.enabled", havingValue = "true")
public class LiveCheckGuardConfig implements WebMvcConfigurer {

    private final LiveCheckGuard guard;

    public LiveCheckGuardConfig(@Value("${cevoc.live-check.token:}") String token) {
        this.guard = new LiveCheckGuard(token);
        String t = token == null ? "" : token.strip();
        LoggerFactory.getLogger(LiveCheckGuardConfig.class).info("live-check guard active: token {}, length {}, sha256 prefix {}",
                t.isEmpty() ? "NOT configured" : "configured", t.length(), prefix(t));
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(guard).addPathPatterns("/live-check/**");
    }

    private static String prefix(String t) {
        try {
            byte[] d = MessageDigest.getInstance("SHA-256").digest(t.getBytes(StandardCharsets.UTF_8));
            return String.format("%02x%02x%02x", d[0], d[1], d[2]);
        } catch (Exception e) {
            return "n/a";
        }
    }
}
