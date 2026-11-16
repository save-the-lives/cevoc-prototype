package cevoc.adapter.in.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * The site and the API share one address (record 0031): the built frontend is served from {@code /app/site}
 * ({@code spring.web.resources.static-locations}), and {@code /} serves its index page. The page paths the frontend
 * reads from the address bar are listed here and answered with the same index page; everything else under them is
 * the API's. A path not listed and not a file answers 404, as before.
 */
@Controller
public class SiteController {

    @GetMapping({"/demo-cases", "/demo-cases/", "/test-cases", "/test-cases/", "/live-check", "/live-check/"})
    public String page() {
        return "forward:/index.html";
    }
}
