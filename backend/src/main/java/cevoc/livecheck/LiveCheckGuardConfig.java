package cevoc.livecheck;

import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Puts the one-lookup-at-a-time guard in front of /live-check/**. Absent unless cevoc.live-check.enabled=true (env CEVOC_LIVECHECK_ENABLED).
 * There is no token any more: the endpoints are open while live check is enabled and do not exist otherwise.
 */
@Configuration
@ConditionalOnProperty(name = "cevoc.live-check.enabled", havingValue = "true")
public class LiveCheckGuardConfig implements WebMvcConfigurer {

    private final LiveCheckGuard guard = new LiveCheckGuard();

    public LiveCheckGuardConfig() {
        LoggerFactory.getLogger(LiveCheckGuardConfig.class).info("live-check guard active: open, one lookup at a time");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(guard).addPathPatterns("/live-check/**");
    }
}
