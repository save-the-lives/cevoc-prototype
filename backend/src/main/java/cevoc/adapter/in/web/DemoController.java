package cevoc.adapter.in.web;

import cevoc.application.port.out.DemoCatalogPort;
import cevoc.application.port.out.DemoMediaPort;
import cevoc.domain.MediaContent;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * The demo hub's list of cases and the generated sample images. Deliberately NOT a component-scanned stereotype: it only
 * exists as a bean while demo data is switched on (registered in {@code DemoDataConfig}), so with the switch off both
 * paths are plain unknown paths (404). Fictitious data only; no request value is echoed.
 */
@RequestMapping("/api/demo")
@ResponseBody
public class DemoController {

    private final DemoCatalogPort catalog;
    private final DemoMediaPort media;

    public DemoController(DemoCatalogPort catalog, DemoMediaPort media) {
        this.catalog = catalog;
        this.media = media;
    }

    /** The cases, grouped by program and kind, with the transparency status per information type. */
    public record Cases(String notice, List<DemoCatalogPort.Program> programs) {}

    @GetMapping("/cases")
    public Cases cases() {
        return new Cases("Demo data, not real notices. Every number, place and image here is fictitious.", catalog.programs());
    }

    @GetMapping("/media/{number:\\d{10}}/{name:[a-z0-9.-]{1,40}}")
    public ResponseEntity<byte[]> image(@PathVariable String number, @PathVariable String name) {
        return media.read(number, name).map(DemoController::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }

    private static ResponseEntity<byte[]> ok(MediaContent c) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(c.contentType()))
                .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .body(c.data());
    }
}
