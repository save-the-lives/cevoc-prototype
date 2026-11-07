package cevoc.adapter.in.web;

import cevoc.adapter.in.web.PenaltyLookupController.LookupBody;
import cevoc.application.port.in.LookupPenaltyUseCase;
import cevoc.application.port.in.LookupSink;
import cevoc.domain.CertificateAssessment;
import cevoc.domain.CertificateCoverage;
import cevoc.domain.CertificateItem;
import cevoc.domain.EvidenceItem;
import cevoc.domain.NoticeDetails;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.RegistrationScope;
import jakarta.annotation.PreDestroy;
import jakarta.validation.Valid;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * The same public lookup as {@code POST /api/penalty-lookups}, delivered as Server-Sent Events over ONE request so the
 * page can show each part as it is known: {@code details}, then {@code evidence}, then {@code certificates}, then
 * {@code done}; or {@code error} with a whitelisted cause token. It is a POST (read with fetch, not EventSource) so the
 * registration number travels in the body, is request-scoped exactly as in the JSON endpoint, and one request means one
 * browser session. The JSON endpoint is unchanged. No event carries the registration or any request value.
 */
@RestController
@RequestMapping("/api/penalty-lookups/stream")
public class PenaltyLookupStreamController {

    static final long TIMEOUT_MS = 150_000;
    private static final long HEARTBEAT_SECONDS = 8;

    private final LookupPenaltyUseCase useCase;
    private final ThreadPoolExecutor workers = new ThreadPoolExecutor(2, 2, 30, TimeUnit.SECONDS, new ArrayBlockingQueue<>(6), r -> {
        Thread t = new Thread(r, "lookup-stream");
        t.setDaemon(true);
        return t;
    });
    private final ScheduledExecutorService beat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "lookup-stream-beat");
        t.setDaemon(true);
        return t;
    });

    public PenaltyLookupStreamController(LookupPenaltyUseCase useCase) {
        this.useCase = useCase;
    }

    @PreDestroy
    void stop() {
        workers.shutdownNow();
        beat.shutdownNow();
    }

    /** Event payloads. Fixed shapes; none holds a request value. */
    public record Details(PenaltyLookupResult.Status status, String infringementNumber, String summary, NoticeDetails notice,
                          String source) {}

    public record Evidence(List<EvidenceItem> evidence, boolean plateRequired) {}

    public record Certificates(List<CertificateItem> certificates,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
                               CertificateCoverage coverage,
                               @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_EMPTY)
                               List<CertificateAssessment.UncoveredType> uncoveredTypes) {}

    /** The flexible details map (record 0009); sent only when a route returned any. */
    public record Extra(java.util.Map<String, Object> details) {}

    public record Done(boolean ok) {}

    public record Failure(String cause) {}

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public ResponseEntity<SseEmitter> stream(@Valid @RequestBody LookupBody body) {
        PenaltyLookupRequest request = new PenaltyLookupRequest(body.infringementNumber().trim(), body.offenceDate());
        String plate = PenaltyLookupController.cleanRegistration(body.registration());
        SseEmitter emitter = new SseEmitter(TIMEOUT_MS);
        AtomicBoolean open = new AtomicBoolean(true);
        emitter.onCompletion(() -> open.set(false));
        emitter.onTimeout(() -> open.set(false));
        emitter.onError(e -> open.set(false));
        try {
            workers.execute(() -> run(emitter, open, request, plate));
        } catch (RejectedExecutionException busy) {
            send(emitter, open, "error", new Failure("busy"));
            emitter.complete();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_EVENT_STREAM)
                .header("Cache-Control", "no-cache, no-transform")
                .header("X-Accel-Buffering", "no")
                .body(emitter);
    }

    private void run(SseEmitter emitter, AtomicBoolean open, PenaltyLookupRequest request, String plate) {
        // Opens the stream at once (headers and a first line reach the browser before the slow part starts).
        comment(emitter, open, "open");
        ScheduledFuture<?> heart = beat.scheduleAtFixedRate(() -> comment(emitter, open, "ping"),
                HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
        boolean[] finished = new boolean[1];
        LookupSink sink = new LookupSink() {
            @Override
            public void details(PenaltyLookupResult d) {
                send(emitter, open, "details", new Details(d.status(), d.infringementNumber(), d.summary(), d.notice(), d.source()));
                if (d.status() != PenaltyLookupResult.Status.FOUND) {
                    // The stream carries "evidence": [] for the unhappy cases so the page can settle every section.
                    send(emitter, open, "evidence", new Evidence(List.of(), false));
                    send(emitter, open, "certificates", new Certificates(List.of(), null));
                }
            }

            @Override
            public void evidence(List<EvidenceItem> evidence, boolean plateRequired) {
                send(emitter, open, "evidence", new Evidence(evidence, plateRequired));
            }

            @Override
            public void extra(java.util.Map<String, Object> details) {
                send(emitter, open, "extra", new Extra(details));
            }

            @Override
            public void certificates(List<CertificateItem> certificates) {
                send(emitter, open, "certificates", new Certificates(certificates, null, List.of()));
            }

            @Override
            public void certificates(List<CertificateItem> certificates, CertificateCoverage coverage) {
                send(emitter, open, "certificates", new Certificates(certificates, coverage, List.of()));
            }

            @Override
            public void certificates(List<CertificateItem> certificates, CertificateCoverage coverage,
                                     List<CertificateAssessment.UncoveredType> uncoveredTypes) {
                send(emitter, open, "certificates", new Certificates(certificates, coverage, uncoveredTypes));
            }

            @Override
            public void done() {
                finished[0] = true;
                send(emitter, open, "done", new Done(true));
            }

            @Override
            public void error(String cause) {
                finished[0] = true;
                send(emitter, open, "error", new Failure(whitelisted(cause)));
            }
        };
        try {
            // Request-scoped: set for this call on this thread only and removed in a finally block; never stored or logged.
            if (plate == null) {
                useCase.lookup(request, sink);
            } else {
                RegistrationScope.with(plate, () -> {
                    useCase.lookup(request, sink);
                    return null;
                });
            }
        } catch (RuntimeException e) {
            if (!finished[0]) {
                send(emitter, open, "error", new Failure("source-failed"));
            }
        } finally {
            heart.cancel(false);
            open.set(false);
            try {
                emitter.complete();
            } catch (RuntimeException ignored) {
                // already completed by the container (client gone)
            }
        }
    }

    /** Cause tokens are lower-case words and dashes (see StepCause); anything else is replaced. */
    static String whitelisted(String cause) {
        return cause != null && cause.matches("[a-z0-9-]{1,40}") ? cause : "source-failed";
    }

    private static void comment(SseEmitter emitter, AtomicBoolean open, String text) {
        if (!open.get()) {
            return;
        }
        try {
            synchronized (emitter) {
                emitter.send(SseEmitter.event().comment(text));
            }
        } catch (IOException | RuntimeException e) {
            open.set(false);
        }
    }

    private static void send(SseEmitter emitter, AtomicBoolean open, String name, Object data) {
        if (!open.get()) {
            return;
        }
        try {
            synchronized (emitter) {
                emitter.send(SseEmitter.event().name(name).data(data, MediaType.APPLICATION_JSON));
            }
        } catch (IOException | RuntimeException e) {
            // The browser went away: stop sending; the lookup finishes by itself and its result is dropped.
            open.set(false);
        }
    }
}
