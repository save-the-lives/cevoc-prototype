package cevoc.adapter.out.demo;

import cevoc.application.port.out.DemoBundleSourcePort;
import java.io.IOException;
import java.util.Optional;
import java.util.function.LongSupplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Decides where demo media comes from and whether demo content is available at all (decision record 0018).
 * <ul>
 *   <li>No bundle URL configured: the built-in sample content is used (the generated SVG images and the sample video that
 *       ship with the app). Nothing is fetched.</li>
 *   <li>A bundle URL configured: the bundle is fetched lazily on first demo use over the {@link DemoBundleSourcePort} and
 *       verified (checksum, version, licences). On success its media is served. On ANY failure demo content is
 *       unavailable: a demo number is passed on to the real route like any other number, the hub says demo content is not
 *       available, one clear log line is written, and the app carries on. After a cool-down the next demo use tries again.</li>
 * </ul>
 * Never half-loaded: either a fully verified bundle is active or none.
 */
public final class DemoContentGate implements DemoMediaSource {

    private static final Logger LOG = LoggerFactory.getLogger(DemoContentGate.class);
    static final long MAX_BUNDLE_BYTES = 100L * 1024 * 1024;

    private final DemoBundleSourcePort source;
    private final String url;
    private final String version;
    private final String sha256;
    private final DemoMediaSource builtIn;
    private final LongSupplier clock;
    private final long retryAfterMillis;
    private DemoMediaSource active;
    private long failedAt = -1;

    public DemoContentGate(DemoBundleSourcePort source, String url, String version, String sha256, DemoMediaSource builtIn,
                           LongSupplier clock, long retryAfterMillis) {
        this.source = source;
        this.url = url == null ? "" : url.trim();
        this.version = version;
        this.sha256 = sha256;
        this.builtIn = builtIn;
        this.clock = clock;
        this.retryAfterMillis = retryAfterMillis;
    }

    @Override
    public synchronized boolean available() {
        return current() != null;
    }

    @Override
    public DemoMediaSet mediaFor(DemoScenario scenario) {
        DemoMediaSource m = currentSource();
        return m == null ? DemoMediaSet.empty() : m.mediaFor(scenario);
    }

    @Override
    public Optional<Bytes> read(String number, String name) {
        DemoMediaSource m = currentSource();
        return m == null ? Optional.empty() : m.read(number, name);
    }

    private synchronized DemoMediaSource currentSource() {
        return current();
    }

    private DemoMediaSource current() {
        if (url.isEmpty()) {
            return builtIn;
        }
        if (active != null) {
            return active;
        }
        if (failedAt >= 0 && clock.getAsLong() - failedAt < retryAfterMillis) {
            return null;
        }
        try {
            byte[] archive = source.fetch(url, MAX_BUNDLE_BYTES);
            DemoBundle bundle = DemoBundle.open(archive, sha256, version);
            active = new BundleMediaSource(bundle);
            failedAt = -1;
            LOG.info("Demo content bundle version {} loaded ({} files).", bundle.version(), bundle.entries().size());
            return active;
        } catch (IOException | DemoBundleException | RuntimeException e) {
            failedAt = clock.getAsLong();
            LOG.warn("Demo content is not available, so demo mode is off for now: {}. Real lookups are not affected.",
                    e instanceof RuntimeException ? e.getClass().getSimpleName() : e.getMessage());
            return null;
        }
    }
}
