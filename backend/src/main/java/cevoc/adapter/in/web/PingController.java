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
}
