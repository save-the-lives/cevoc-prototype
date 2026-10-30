package au.gov.nsw.transport.cevoc.livecheck;

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
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(guard).addPathPatterns("/live-check/**");
    }
}
