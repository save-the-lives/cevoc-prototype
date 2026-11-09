package cevoc.adapter.in.web;

import cevoc.application.port.out.BlurPort;
import cevoc.application.port.out.DemoCatalogPort;
import cevoc.application.port.out.DemoMediaPort;
import cevoc.domain.MediaContent;
import java.time.Duration;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.function.RouterFunction;
import org.springframework.web.servlet.function.RouterFunctions;
import org.springframework.web.servlet.function.ServerResponse;

/**
 * The demo hub's list of cases and the generated sample images, as functional routes (not a scanned controller) so they exist
 * only when {@code DemoDataConfig} registers them, that is only while demo data is switched on. With the switch off both paths
 * are plain unknown paths (404). Fictitious data only; no request value is echoed.
 */
public final class DemoRoutes {

    private static final Pattern NUMBER = Pattern.compile("\\d{10}");
    private static final Pattern NAME = Pattern.compile("[a-z0-9.-]{1,40}");

    private DemoRoutes() {}

    /** The cases, grouped by program and kind, with the transparency status per information type. */
    public record Cases(String notice, boolean available, List<DemoCatalogPort.Program> programs) {}

    public static RouterFunction<ServerResponse> routes(DemoCatalogPort catalog, DemoMediaPort media) {
        return routes(catalog, media, null, null);
    }

    public static RouterFunction<ServerResponse> routes(DemoCatalogPort catalog, DemoMediaPort media, BlurPort blur, DemoVideoSource videoSource) {
        return RouterFunctions.route()
                .GET("/api/demo/cases", req -> ServerResponse.ok().contentType(MediaType.APPLICATION_JSON)
                        .body(catalog.available()
                                ? new Cases("Demo data, not real notices. Every number, place and image here is fictitious.", true, catalog.programs())
                                : new Cases("Demo content is not available right now. Real lookups are not affected.", false, List.of())))
                .GET("/api/demo/media/video/{name}", req -> {
                    if (blur == null || videoSource == null) {
                        return ServerResponse.status(503).body("Video blurring not configured");
                    }
                    String name = req.pathVariable("name");
                    if (!NAME.matcher(name).matches()) {
                        return ServerResponse.notFound().build();
                    }
                    return videoSource.read(name)
                            .map(raw -> {
                                BlurPort.Result result = blur.blurVideo(raw, "ABC123");
                                if (!result.success()) {
                                    return ServerResponse.status(503).body("Video not available: " + result.detail());
                                }
                                return okVideo(result);
                            })
                            .orElseGet(() -> ServerResponse.notFound().build());
                })
                .GET("/api/demo/media/{number}/{name}", req -> {
                    String number = req.pathVariable("number");
                    String name = req.pathVariable("name");
                    if (!NUMBER.matcher(number).matches() || !NAME.matcher(name).matches()) {
                        return ServerResponse.notFound().build();
                    }
                    return media.read(number, name).map(DemoRoutes::ok).orElseGet(() -> ServerResponse.notFound().build());
                })
                .build();
    }

    /** Source of raw demo video bytes by filename. */
    public interface DemoVideoSource {
        java.util.Optional<byte[]> read(String name);
    }

    private static ServerResponse okVideo(BlurPort.Result r) {
        return ServerResponse.ok()
                .contentType(MediaType.parseMediaType("video/mp4"))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .body(r.data());
    }

    private static ServerResponse ok(MediaContent c) {
        return ServerResponse.ok()
                .contentType(MediaType.parseMediaType(c.contentType()))
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(5)).cachePublic())
                .header("X-Content-Type-Options", "nosniff")
                .header("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox")
                .header("Cross-Origin-Resource-Policy", "cross-origin")
                .body(c.data());
    }
}
