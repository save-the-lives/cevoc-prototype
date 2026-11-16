package cevoc.adapter.in.web;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Harmless "is the app up" answer for the post-deploy check (record 0021). Touches no port, no adapter and no network,
 * so it can never reach an external site whatever the environment variables select.
 */
@RestController
public class PingController {

    @GetMapping(value = "/api/ping", produces = MediaType.TEXT_PLAIN_VALUE)
    public String ping() {
        return "ok";
    }

    /**
     * The commit the running image was built from (build argument BUILD_SHA, baked in as CEVOC_BUILD_SHA). The deploy
     * workflows wait until this matches what they deployed, so a check never runs against the previous revision, which
     * keeps answering until the new one is ready.
     */
    @GetMapping(value = "/api/version", produces = MediaType.TEXT_PLAIN_VALUE)
    public String version() {
        String v = System.getenv("CEVOC_BUILD_SHA");
        return v == null || v.isBlank() ? "unknown" : v;
    }
}
