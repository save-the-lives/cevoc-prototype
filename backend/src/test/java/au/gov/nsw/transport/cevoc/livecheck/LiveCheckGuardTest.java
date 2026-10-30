package au.gov.nsw.transport.cevoc.livecheck;

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

/** Token guard for /live-check/*, tested in the default build with a stand-in controller (the real one is in the live-browser source set). */
class LiveCheckGuardTest {

    @RestController
    static class Stub {
        @GetMapping("/live-check/ping")
        String ping() {
            return "ok";
        }
    }

    @Nested
    @SpringBootTest(properties = {"cevoc.live-check.enabled=true", "cevoc.live-check.token=fictitious-token-123",
            "cevoc.cors.allowed-origins=https://front.example.test"})
    @AutoConfigureMockMvc
    @Import(Stub.class)
    class WithToken {
        @Autowired MockMvc mvc;

        @Test
        void missingHeaderIs401() throws Exception {
            mvc.perform(get("/live-check/ping")).andExpect(status().isUnauthorized());
        }

        @Test
        void wrongTokenIs401() throws Exception {
            mvc.perform(get("/live-check/ping").header(LiveCheckGuard.HEADER, "nope")).andExpect(status().isUnauthorized());
        }

        @Test
        void rightTokenPasses() throws Exception {
            mvc.perform(get("/live-check/ping").header(LiveCheckGuard.HEADER, "fictitious-token-123"))
                    .andExpect(status().isOk()).andExpect(content().string("ok"));
        }

        @Test
        void preflightFromFrontendOriginAllowedWithoutToken() throws Exception {
            mvc.perform(options("/live-check/lookup")
                            .header("Origin", "https://front.example.test")
                            .header("Access-Control-Request-Method", "POST")
                            .header("Access-Control-Request-Headers", "Content-Type,X-Live-Check-Token"))
                    .andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", "https://front.example.test"));
        }
    }

    @Nested
    @SpringBootTest(properties = {"cevoc.live-check.enabled=true"})
    @AutoConfigureMockMvc
    @Import(Stub.class)
    class EnabledWithoutToken {
        @Autowired MockMvc mvc;

        @Test
        void endpointsDisabledEvenWithAHeader() throws Exception {
            mvc.perform(get("/live-check/ping")).andExpect(status().isNotFound());
            mvc.perform(get("/live-check/ping").header(LiveCheckGuard.HEADER, "anything")).andExpect(status().isNotFound());
        }
    }

    @Test
    void onlyOneLookupAtATime() throws Exception {
        var guard = new LiveCheckGuard("fictitious-token-123");
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
    void blankTokenDisablesEverything() throws Exception {
        var guard = new LiveCheckGuard("  ");
        var res = new MockHttpServletResponse();
        assertFalse(guard.preHandle(lookup(), res, new Object()));
        assertEquals(404, res.getStatus());
    }

    private static MockHttpServletRequest lookup() {
        var r = new MockHttpServletRequest("POST", "/live-check/lookup");
        r.addHeader(LiveCheckGuard.HEADER, "fictitious-token-123");
        return r;
    }
}
