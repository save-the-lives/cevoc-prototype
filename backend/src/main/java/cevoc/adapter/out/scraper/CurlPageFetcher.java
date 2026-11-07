package cevoc.adapter.out.scraper;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.StringJoiner;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;

/**
 * Fetches pages by running the {@code curl} command line program (decision 0025). The bot management in front of the certificates
 * page judges the TLS fingerprint; curl (OpenSSL) is accepted where the JDK client is not. One fetcher is one lookup: it owns a
 * private temp directory holding the cookie jar (shared by the GET and the POST), the response body and the POST body, and
 * {@link #close()} deletes it. Logged: method, HTTP status, milliseconds, curl exit code and, on failure, curl's stderr
 * (never the body, never a form value).
 */
final class CurlPageFetcher implements PageFetcher, AutoCloseable {

    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(CurlPageFetcher.class);
    private static final Pattern SESSION_ID = Pattern.compile("(?i)jsessionid=[^\\s&?/\"']*");

    /** What a finished curl process left. */
    record Result(int exitCode, String stdout, String stderr) {}

    /** Seam so tests never start a process. */
    @FunctionalInterface
    interface Runner {
        Result run(List<String> command, Duration limit) throws IOException, InterruptedException;
    }

    private final String curl;
    private final Duration timeout;
    private final Runner runner;
    private final Path dir;
    private final Path jar;
    private String lastPageUrl;
    private int seq;

    CurlPageFetcher(String curl, Duration timeout, Runner runner) {
        this.curl = curl;
        this.timeout = timeout;
        this.runner = runner;
        try {
            this.dir = Files.createTempDirectory("cevoc-curl-");
            // Owner only: the jar holds the session cookies.
            this.jar = Files.createFile(dir.resolve("cookies.txt"));
        } catch (IOException e) {
            throw new ScrapeException("curl temp files unavailable", e);
        }
    }

    static Runner processRunner() {
        return (command, limit) -> {
            Path out = Files.createTempFile("cevoc-curl-out-", ".txt");
            Path err = Files.createTempFile("cevoc-curl-err-", ".txt");
            try {
                Process p = new ProcessBuilder(command).redirectOutput(out.toFile()).redirectError(err.toFile())
                        .redirectInput(ProcessBuilder.Redirect.from(new java.io.File("/dev/null"))).start();
                if (!p.waitFor(limit.toMillis(), TimeUnit.MILLISECONDS)) {
                    p.destroyForcibly();
                    return new Result(-1, "", "killed after " + limit.toSeconds() + "s");
                }
                return new Result(p.exitValue(), Files.readString(out, StandardCharsets.UTF_8), Files.readString(err, StandardCharsets.UTF_8));
            } finally {
                Files.deleteIfExists(out);
                Files.deleteIfExists(err);
            }
        };
    }

    @Override
    public String get(String url) {
        lastPageUrl = url;
        Path body = dir.resolve("body-" + (++seq) + ".html");
        return execute("GET", command(curl, timeout, url, jar, body, BrowserHeadersForCurl.forGet(), null), body);
    }

    @Override
    public String postForm(String url, Map<String, String> fields) {
        StringJoiner form = new StringJoiner("&");
        fields.forEach((k, v) -> form.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "="
                + URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8)));
        Path payload = dir.resolve("post-" + (++seq) + ".txt");
        Path body = dir.resolve("body-" + seq + ".html");
        try {
            // The form (it holds the view state) goes by file, so it never appears in the process list.
            Files.writeString(payload, form.toString(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new ScrapeException("curl temp files unavailable", e);
        }
        return execute("POST", command(curl, timeout, url, jar, body, BrowserHeadersForCurl.forPost(lastPageUrl == null ? url : lastPageUrl, url), payload), body);
    }

    /**
     * The exact argument list. {@code payload} null means GET. The URL is the last argument; nothing else varies between lookups.
     * Example (GET): {@code curl --silent --show-error --compressed --location --max-redirs 5 --proto =https --proto-redir =https
     * --connect-timeout 10 --max-time 10 --cookie JAR --cookie-jar JAR -H ... --output BODY --write-out %{http_code} URL}
     */
    static List<String> command(String curl, Duration timeout, String url, Path jar, Path body, Map<String, String> headers, Path payload) {
        long secs = Math.max(1, timeout.toSeconds());
        List<String> c = new ArrayList<>(List.of(curl, "--silent", "--show-error", "--compressed",
                "--location", "--max-redirs", "5", "--proto", "=https", "--proto-redir", "=https",
                "--connect-timeout", Long.toString(secs), "--max-time", Long.toString(secs),
                "--cookie", jar.toString(), "--cookie-jar", jar.toString()));
        headers.forEach((k, v) -> {
            c.add("-H");
            c.add(k + ": " + v);
        });
        if (payload != null) {
            c.add("--data-binary");
            c.add("@" + payload);
        }
        c.addAll(List.of("--output", body.toString(), "--write-out", "%{http_code}", url));
        return c;
    }

    private String execute(String method, List<String> command, Path body) {
        long started = System.nanoTime();
        Result r;
        try {
            r = runner.run(command, timeout.plusSeconds(5));
        } catch (IOException e) {
            LOG.warn("Certificate curl request failed: method={}, cause=cannot-start-curl ({})", method, e.getClass().getSimpleName());
            throw new ScrapeException("curl-unavailable", e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ScrapeException("Interrupted", e);
        }
        long ms = (System.nanoTime() - started) / 1_000_000;
        if (r.exitCode() != 0) {
            LOG.warn("Certificate curl request failed: method={}, exit={}, ms={}, stderr={}", method, r.exitCode(), ms, clean(r.stderr()));
            throw new ScrapeException("curl-exit-" + r.exitCode());
        }
        int status = parseStatus(r.stdout());
        LOG.info("Certificate curl request: method={}, status={}, exit=0, ms={}", method, status, ms);
        if (status == 401 || status == 403 || status == 429) {
            LOG.warn("Certificate request blocked: status={}, method={}, ms={}", status, method, ms);
            throw new ScrapeException("blocked-" + status);
        }
        if (status / 100 != 2) {
            throw new ScrapeException("Source returned HTTP " + status);
        }
        try {
            return Files.readString(body, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new ScrapeException("curl response unreadable", e);
        }
    }

    static int parseStatus(String stdout) {
        try {
            return Integer.parseInt(stdout == null ? "" : stdout.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /** One line, session ids removed, capped. */
    static String clean(String stderr) {
        String s = SESSION_ID.matcher(stderr == null ? "" : stderr).replaceAll("jsessionid=-").replaceAll("\\s+", " ").trim();
        return s.length() > 300 ? s.substring(0, 300) : s;
    }

    @Override
    public void close() {
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException | RuntimeException ignored) {
            // best effort; the files hold only session cookies and a public page
        }
    }

    Path directory() {
        return dir;
    }

    /** The headers owner-proven for curl (decision 0025). */
    static final class BrowserHeadersForCurl {
        private BrowserHeadersForCurl() {}

        private static Map<String, String> common() {
            Map<String, String> h = new java.util.LinkedHashMap<>();
            h.put("User-Agent", BrowserHeaders.USER_AGENT);
            h.put("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            h.put("Accept-Language", "en-AU,en;q=0.9");
            h.put("Accept-Encoding", "gzip, deflate, br");
            h.put("Sec-Fetch-Mode", "navigate");
            h.put("Sec-Fetch-Dest", "document");
            h.put("Connection", "keep-alive");
            return h;
        }

        static Map<String, String> forGet() {
            Map<String, String> h = common();
            h.put("Sec-Fetch-Site", "none");
            return h;
        }

        static Map<String, String> forPost(String pageUrl, String actionUrl) {
            Map<String, String> h = common();
            URI action = URI.create(actionUrl);
            h.put("Sec-Fetch-Site", "same-origin");
            h.put("Content-Type", "application/x-www-form-urlencoded");
            h.put("Origin", action.getScheme() + "://" + action.getAuthority());
            h.put("Referer", pageUrl);
            return h;
        }
    }
}
