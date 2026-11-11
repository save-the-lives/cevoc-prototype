package cevoc.adapter.out.blur;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Redis-backed queue client for QueueBlurAdapter (ADR 0027).
 *
 * <p>Uses the blur worker's CLI mode to push requests and pull completions,
 * avoiding a Redis client dependency in the Java backend. The worker.py script
 * is called as a subprocess — the same pattern as ProcessBlurAdapter uses for
 * the blur pipeline scripts.</p>
 *
 * <p>For production, this can be replaced with a Jedis or Lettuce implementation
 * that talks directly to Redis, or with an SQS/Azure Queue client.</p>
 */
public final class RedisQueueClient implements QueueBlurAdapter.QueueClient {

    private static final Logger log = LoggerFactory.getLogger(RedisQueueClient.class);
    private final Path workerScript;

    /**
     * @param workerScript path to worker.py (e.g. /app/blur-worker/worker.py)
     */
    public RedisQueueClient(Path workerScript) {
        this.workerScript = workerScript;
    }

    @Override
    public void pushRequest(String messageJson) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "python3", "-I", workerScript.toString(),
                    "--push", messageJson);
            pb.redirectErrorStream(true);
            pb.environment().put("PYTHONDONTWRITEBYTECODE", "1");
            Process p = pb.start();
            boolean ok = p.waitFor(10, TimeUnit.SECONDS) && p.exitValue() == 0;
            if (!ok) {
                log.error("Failed to push blur request via worker.py (exit {})",
                        p.isAlive() ? "timeout" : p.exitValue());
                if (p.isAlive()) p.destroyForcibly();
            }
        } catch (IOException | InterruptedException e) {
            log.error("Failed to push blur request", e);
        }
    }

    @Override
    public String pullCompletion(int timeoutS) throws InterruptedException {
        // Poll Redis via a lightweight Python one-liner to avoid full worker startup.
        // In production, use a Jedis/Lettuce client directly.
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    "python3", "-I", "-c",
                    """
                    import os, json, sys
                    try:
                        import redis
                        r = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379/0'), decode_responses=True)
                        group = 'blur-backend'
                        consumer = 'backend-poller'
                        stream = os.environ.get('BLUR_COMPLETION_QUEUE', 'blur-completions')
                        try:
                            r.xgroup_create(stream, group, id='0', mkstream=True)
                        except redis.exceptions.ResponseError:
                            pass
                        result = r.xreadgroup(group, consumer, {stream: '>'}, count=1, block=%d)
                        if result:
                            _, msgs = result[0]
                            msg_id, fields = msgs[0]
                            r.xack(stream, group, msg_id)
                            print(fields.get('data', '{}'))
                        else:
                            print()
                    except Exception as e:
                        print(json.dumps({"error": str(e)}), file=sys.stderr)
                        print()
                    """.formatted(timeoutS * 1000));
            pb.redirectErrorStream(false);
            pb.environment().put("PYTHONDONTWRITEBYTECODE", "1");
            Process p = pb.start();
            String line;
            try (var reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                line = reader.readLine();
            }
            p.waitFor(timeoutS + 5, TimeUnit.SECONDS);
            if (p.isAlive()) p.destroyForcibly();
            if (line == null || line.isBlank()) return null;
            return line;
        } catch (IOException e) {
            log.error("Failed to pull completion", e);
            return null;
        }
    }
}
