package cevoc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** The public Server-Sent Events lookup, over the default (manifest, fictitious) configuration. */
@SpringBootTest(properties = "cevoc.cors.allowed-origins=https://front.example.test")
@AutoConfigureMockMvc
class PenaltyLookupStreamTest {

    @Autowired MockMvc mvc;

    private String stream(String json) throws Exception {
        MvcResult result = mvc.perform(post("/api/penalty-lookups/stream").contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM).content(json))
                .andExpect(request().asyncStarted()).andReturn();
        await().atMost(Duration.ofSeconds(10)).until(() -> {
            String c = result.getResponse().getContentAsString();
            return c.contains("event:done") || c.contains("event:error");
        });
        assertThat(result.getResponse().getContentType()).startsWith("text/event-stream");
        return result.getResponse().getContentAsString();
    }

    @Test
    void sendsDetailsThenEvidenceThenCertificatesThenDone() throws Exception {
        String body = stream("{\"infringementNumber\":\"9000000001\",\"offenceDate\":\"2026-09-01\"}");
        int d = body.indexOf("event:details");
        int e = body.indexOf("event:evidence");
        int c = body.indexOf("event:certificates");
        int done = body.indexOf("event:done");
        assertThat(d).isGreaterThanOrEqualTo(0);
        assertThat(e).isGreaterThan(d);
        assertThat(c).isGreaterThan(e);
        assertThat(done).isGreaterThan(c);
        assertThat(body).contains("\"status\":\"FOUND\"").contains("\"plateRequired\":false").doesNotContain("event:error");
    }

    @Test
    void anUnknownNoticeIsDetailsThenDone() throws Exception {
        String body = stream("{\"infringementNumber\":\"X000000001\",\"offenceDate\":\"2026-09-01\"}");
        assertThat(body).contains("event:details").contains("NOT_FOUND").contains("event:done").doesNotContain("event:error");
    }

    @Test
    void theRegistrationIsNeverEchoedInAnyEvent() throws Exception {
        String body = stream("{\"infringementNumber\":\"9000000001\",\"offenceDate\":\"2026-09-01\",\"registration\":\"TST123\"}");
        assertThat(body).doesNotContain("TST123").doesNotContain("tst123");
    }

    @Test
    void aBadBodyIsRejectedBeforeAnyStream() throws Exception {
        mvc.perform(post("/api/penalty-lookups/stream").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1234567890\",\"offenceDate\":\"2999-01-01\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void theJsonEndpointStillAnswersAsBefore() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"9000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk());
    }

    @Test
    void theStaticWebAppOriginMayCallTheStreamAndTheMediaEndpoint() throws Exception {
        mvc.perform(options("/api/penalty-lookups/stream").header("Origin", "https://front.example.test")
                        .header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://front.example.test"));
        mvc.perform(get("/api/media/unknowntoken0000001").header("Origin", "https://front.example.test"))
                .andExpect(status().isNotFound());
    }
}
