package cevoc.adapter.out.revenuensw;

import cevoc.adapter.out.scraper.RequestScopedRegistration;
import cevoc.application.port.out.MediaStoragePort;
import cevoc.application.port.out.PenaltyLookupPort;
import java.time.Duration;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;

/** Builds the plain HTTP adapter from properties ({@code cevoc.revenue-nsw-http.*}), so BeanConfig needs only a one-line bean. */
public final class RevenueNswHttpFactory {

    /** The value of {@code cevoc.penalty-lookup.adapter} that selects this route. */
    public static final String ADAPTER = "revenue-nsw-http";
    private static final Logger LOG = LoggerFactory.getLogger(RevenueNswHttpFactory.class);

    private RevenueNswHttpFactory() {}

    public static PenaltyLookupPort create(Environment env, MediaStoragePort media) {
        RevenueNswHttpSettings s = settings(env);
        if (!s.usable()) {
            LOG.warn("cevoc.penalty-lookup.adapter=revenue-nsw-http but it is not enabled and fully configured; lookups report it as switched off");
        }
        return new RevenueNswHttpLookupAdapter(s, new JdkHttpTransport(s.connectTimeout()), media, new RequestScopedRegistration());
    }

    static RevenueNswHttpSettings settings(Environment env) {
        String p = "cevoc.revenue-nsw-http.";
        String hosts = env.getProperty(p + "allowed-hosts", RevenueNswHttpSettings.DEFAULT_HOST);
        Set<String> allowed = Arrays.stream(hosts.split(",")).map(h -> h.trim().toLowerCase(Locale.ROOT)).filter(h -> !h.isEmpty())
                .collect(Collectors.toSet());
        return new RevenueNswHttpSettings(
                env.getProperty(p + "enabled", Boolean.class, false),
                env.getProperty(p + "base-url", ""),
                env.getProperty(p + "path-prefix", ""),
                env.getProperty(p + "contact", ""),
                env.getProperty(p + "approval-reference", ""),
                env.getProperty(p + "authorization-scheme", ""),
                env.getProperty(p + "offence-date-format", "yyyy-MM-dd"),
                Duration.ofMillis(env.getProperty(p + "min-interval-ms", Long.class, RevenueNswHttpSettings.DEFAULT_MIN_INTERVAL.toMillis())),
                Duration.ofMillis(env.getProperty(p + "connect-timeout-ms", Long.class, RevenueNswHttpSettings.DEFAULT_CONNECT_TIMEOUT.toMillis())),
                Duration.ofMillis(env.getProperty(p + "request-timeout-ms", Long.class, RevenueNswHttpSettings.DEFAULT_REQUEST_TIMEOUT.toMillis())),
                env.getProperty(p + "max-bytes", Long.class, RevenueNswHttpSettings.DEFAULT_MAX_BYTES),
                env.getProperty(p + "summary-retries", Integer.class, 1),
                Duration.ofMillis(env.getProperty(p + "retry-backoff-ms", Long.class, RevenueNswHttpSettings.DEFAULT_RETRY_BACKOFF.toMillis())),
                allowed);
    }
}
