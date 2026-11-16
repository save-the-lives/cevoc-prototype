package cevoc.adapter.out.revenuensw;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * The path segment of the Revenue NSW JSON service, learned from what the public page itself calls. The Chromium route
 * loads that page, and the page calls {@code https://api.osr.nsw.gov.au/<segment>/rest/api/v2/fines/...}; this holder keeps
 * the segment so the plain HTTP route can use it without anyone configuring it (record 0030). A configured
 * {@code cevoc.revenue-nsw-http.path-prefix} always wins. Only the segment is kept: never a notice, token, header or body.
 * In memory only, so a restart forgets it and the next browser lookup learns it again.
 */
public final class LearnedServicePath {

    private static final Logger LOG = LoggerFactory.getLogger(LearnedServicePath.class);
    private static final Pattern PATH = Pattern.compile("^/([A-Za-z0-9_-]{1,64})/rest/api/v2/fines(?:/|$)");
    private static final AtomicReference<String> SEGMENT = new AtomicReference<>();
    private static final AtomicReference<Instant> LEARNED_AT = new AtomicReference<>();

    private LearnedServicePath() {}

    /** Offered every request URL the browser makes; keeps the segment of a call to the allowed service host. Never throws. */
    public static void offer(String url) {
        try {
            if (url == null || !url.startsWith("https://")) return;
            URI u = URI.create(url);
            if (u.getHost() == null || !RevenueNswHttpSettings.DEFAULT_HOST.equals(u.getHost().toLowerCase(Locale.ROOT))) return;
            Matcher m = PATH.matcher(u.getRawPath() == null ? "" : u.getRawPath());
            if (!m.find()) return;
            String seg = m.group(1);
            String old = SEGMENT.getAndSet(seg);
            if (!seg.equals(old)) {
                LEARNED_AT.set(Clock.systemUTC().instant());
                LOG.info("Penalty lookup route: http service path learned from the page (changed={})", old != null);
            }
        } catch (RuntimeException ignored) {
            // A malformed URL is simply not a service call.
        }
    }

    /** The learned segment, or null when none has been seen since start-up. */
    public static String get() {
        return SEGMENT.get();
    }

    /** For tests only. */
    static void reset() {
        SEGMENT.set(null);
        LEARNED_AT.set(null);
    }
}
