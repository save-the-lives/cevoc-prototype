package cevoc.livecheck;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Guard for /live-check/*, tested in the default build with a stand-in controller (the real one is in the live-browser source set).
 * There is no token: the endpoints are open while live check is enabled; the guard keeps the one-lookup-at-a-time safeguard.
 */
class LiveCheckGuardTest {

    @RestController
    static class Stub {
        @GetMapping("/live-check/ping")
        String ping() {
            return "ok";
        }
    }

    @Nested
    @SpringBootTest(properties = {"cevoc.live-check.enabled=true", "cevoc.cors.allowed-origins=https://front.example.test"})
    @AutoConfigureMockMvc
    @Import(Stub.class)
    class Enabled {
        @Autowired MockMvc mvc;

        @Test
        void endpointsAreOpenWhileLiveCheckIsEnabled() throws Exception {
            mvc.perform(get("/live-check/ping")).andExpect(status().isOk()).andExpect(content().string("ok"));
        }

        @Test
        void aTokenHeaderIsIgnored() throws Exception {
            mvc.perform(get("/live-check/ping").header("X-Live-Check-Token", "anything")).andExpect(status().isOk());
        }

        @Test
        void preflightFromFrontendOriginAllowed() throws Exception {
            mvc.perform(options("/live-check/lookup")
                            .header("Origin", "https://front.example.test")
                            .header("Access-Control-Request-Method", "POST")
                            .header("Access-Control-Request-Headers", "Content-Type"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", "https://front.example.test"));
        }
    }

    @Nested
    @SpringBootTest
    @AutoConfigureMockMvc
    @Import(Stub.class)
    class NotEnabled {
        @Autowired org.springframework.context.ApplicationContext ctx;

        @Test
        void noGuardExistsByDefault() {
            assertTrue(ctx.getBeansOfType(LiveCheckGuardConfig.class).isEmpty());
        }
    }

    @Test
    void onlyOneLookupAtATime() throws Exception {
        var guard = new LiveCheckGuard();
        var first = lookup();
        var second = lookup();
        assertTrue(guard.preHandle(first, new MockHttpServletResponse(), new Object()));
        var busy = new MockHttpServletResponse();
        assertFalse(guard.preHandle(second, busy, new Object()));
        assertEquals(429, busy.getStatus());
        guard.afterCompletion(first, new MockHttpServletResponse(), new Object(), null);
        assertTrue(guard.preHandle(lookup(), new MockHttpServletResponse(), new Object()));
    }

    @Test
    void otherRequestsPassStraightThrough() throws Exception {
        var guard = new LiveCheckGuard();
        var res = new MockHttpServletResponse();
        assertTrue(guard.preHandle(new MockHttpServletRequest("GET", "/live-check/ping"), res, new Object()));
        assertEquals(200, res.getStatus());
    }

    private static MockHttpServletRequest lookup() {
        return new MockHttpServletRequest("POST", "/live-check/lookup");
    }
}
