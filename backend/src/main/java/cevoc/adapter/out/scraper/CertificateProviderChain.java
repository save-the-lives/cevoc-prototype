package cevoc.adapter.out.scraper;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import java.util.List;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Ordered certificate providers behind the one {@link CertificateSourcePort}: the cutover seam. Config lists them in
 * order of preference (for example {@code api,browser}); the first provider that ANSWERS ends the chain, an
 * empty answer included. A provider that fails hands over to the next one; when all fail the last failure is rethrown.
 * A refusal (message containing blocked-401, blocked-403 or blocked-429) stops the whole chain at once: it is not
 * retried and not worked around by trying another route to the same source.
 */
public final class CertificateProviderChain implements CertificateSourcePort {

    private static final Logger LOG = LoggerFactory.getLogger(CertificateProviderChain.class);

    private final List<CertificateSourcePort> providers;
    private final List<String> ids;

    public CertificateProviderChain(List<CertificateSourcePort> providers) {
        this(java.util.stream.IntStream.range(0, providers == null ? 0 : providers.size()).mapToObj(i -> "provider-" + (i + 1)).toList(), providers);
    }

    /** {@code ids} name the providers for the live-check diagnostics (fixed config ids, never values). */
    public CertificateProviderChain(List<String> ids, List<CertificateSourcePort> providers) {
        if (providers == null || providers.isEmpty() || ids == null || ids.size() != providers.size()) {
            throw new IllegalArgumentException("at least one certificate provider is needed");
        }
        this.providers = List.copyOf(providers);
        this.ids = List.copyOf(ids);
    }

    @Override
    public List<CertificateRef> findCertificates(CertificateQuery query) {
        RuntimeException last = null;
        for (int i = 0; i < providers.size(); i++) {
            try {
                List<CertificateRef> found = providers.get(i).findCertificates(query);
                LOG.info("Certificate provider ok: provider={}, count={}", ids.get(i), found.size());
                return found;
            } catch (RuntimeException e) {
                LookupDiagnostic.note("cert-provider-failed=" + ids.get(i));
                boolean refusal = isRefusal(e);
                // Provider id (fixed config name) and cause token only: no exception message, no query values.
                LOG.warn("Certificate provider failed: provider={}, cause={}, refusal={}, chain-stopped={}", ids.get(i),
                        cause(e), refusal, refusal);
                if (refusal) {
                    throw e;
                }
                last = e;
            }
        }
        throw last;
    }

    private static String cause(Throwable t) {
        return cevoc.domain.StepCause.of(t).token();
    }

    static boolean isRefusal(Throwable t) {
        String m = t == null || t.getMessage() == null ? "" : t.getMessage().lines().findFirst().orElse("").toLowerCase(Locale.ROOT);
        return m.contains("blocked-401") || m.contains("blocked-403") || m.contains("blocked-429");
    }
}
