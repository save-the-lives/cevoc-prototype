package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cevoc.adapter.out.demo.DemoRoute;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Demo data ON (CEVOC_DEMO_DATA_ENABLED=true, set explicitly): the demo adapter, the hub list and the sample images exist. */
@SpringBootTest(properties = {"cevoc.penalty-lookup.adapter=stub", "cevoc.certificates.providers=none", "cevoc.demo-data.enabled=true"})
@AutoConfigureMockMvc
class DemoSwitchOnTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectProvider<DemoRoute> demo;

    @Test
    void theDemoAdapterIsRegisteredWhenSwitchedOn() {
        assertThat(demo.getIfAvailable()).isNotNull();
    }

    @Test
    void aDemoNumberIsAnsweredByTheDemoAdapter() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.source").value("DEMO"))
                .andExpect(jsonPath("$.notice.offenceDate").value("2026-03-14"))
                .andExpect(jsonPath("$.details.timeSinceRed").value(2.3))
                .andExpect(jsonPath("$.evidence[0].url").value("/api/demo/media/1000000001/image-1.svg"))
                .andExpect(jsonPath("$.evidence[3].url").value("/samples/video-1.mp4"));
    }

    @Test
    void theCertificateStepReturnsSampleCertificatesFromTheDemoCertificateSource() throws Exception {
        // several found, one in force
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.certificates.length()").value(1))
                .andExpect(jsonPath("$.certificates[0].coversOffence").value(true))
                .andExpect(jsonPath("$.certificateCoverage.status").value("covered"))
                .andExpect(jsonPath("$.certificates[0].description").value(org.hamcrest.Matchers.startsWith("Fictitious")))
                .andExpect(jsonPath("$.certificates[0].periodText").value("YEARLY"));
        // exactly one found
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000002\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.certificates.length()").value(1))
                .andExpect(jsonPath("$.certificates[0].coversOffence").value(true))
                .andExpect(jsonPath("$.certificates[0].periodText").value("YEARLY"));
        // none found
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000101\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.certificates.length()").value(0))
                .andExpect(jsonPath("$.certificateCoverage.status").value("none"));
        // a failure of the source: no certificates, the lookup itself still answers
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000201\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.certificates.length()").value(0))
                .andExpect(jsonPath("$.certificateCoverage").doesNotExist());
    }

    @Test
    void multiTypeCertificateScenarios() throws Exception {
        // all types covered: two certificate types, both covering
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000109\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.certificates.length()").value(2))
                .andExpect(jsonPath("$.certificates[0].coversOffence").value(true))
                .andExpect(jsonPath("$.certificates[1].coversOffence").value(true))
                .andExpect(jsonPath("$.certificateCoverage.status").value("covered"));
        // one type uncovered: accuracy covers, calibration does not
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000110\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.certificateCoverage.status").value("gap"))
                .andExpect(jsonPath("$.uncoveredTypes.length()").value(1));
        // mixed: accuracy and calibration cover, maintenance does not
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1000000111\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.certificateCoverage.status").value("gap"))
                .andExpect(jsonPath("$.certificates.length()").value(2))
                .andExpect(jsonPath("$.uncoveredTypes.length()").value(1));
    }

    @Test
    void theStreamCarriesTheCertificatesPart() throws Exception {
        MvcResult result = mvc.perform(post("/api/penalty-lookups/stream").contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .content("{\"infringementNumber\":\"1000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(request().asyncStarted()).andReturn();
        await().atMost(Duration.ofSeconds(10)).until(() -> result.getResponse().getContentAsString().contains("event:done"));
        assertThat(result.getResponse().getContentAsString()).contains("event:certificates").contains("\"coversOffence\":true")
                .contains("\"coverage\":{\"status\":\"covered\"");
    }

    @Test
    void theStreamCarriesTheDemoSourceAndTheParts() throws Exception {
        MvcResult result = mvc.perform(post("/api/penalty-lookups/stream").contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.TEXT_EVENT_STREAM)
                        .content("{\"infringementNumber\":\"1000000106\",\"offenceDate\":\"2026-09-01\",\"registration\":\"TST123\"}"))
                .andExpect(request().asyncStarted()).andReturn();
        await().atMost(Duration.ofSeconds(10)).until(() -> result.getResponse().getContentAsString().contains("event:done"));
        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"source\":\"DEMO\"").contains("event:evidence").contains("/api/demo/media/1000000106/image-1.svg")
                .contains("\"plateRequired\":false");
    }

    @Test
    void theHubListsEveryProgramAndCase() throws Exception {
        mvc.perform(get("/api/demo/cases"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.programs.length()").value(7))
                .andExpect(jsonPath("$.programs[0].prefix").value("000000"))
                .andExpect(jsonPath("$.programs[1].prefix").value("100000"))
                .andExpect(jsonPath("$.programs[1].built").value(true))
                .andExpect(jsonPath("$.programs[1].groups[0].kind").value("happy"))
                .andExpect(jsonPath("$.programs[1].groups[0].cases[0].number").value("1000000001"))
                .andExpect(jsonPath("$.programs[1].groups[0].cases[0].transparency.images").value("available"))
                .andExpect(jsonPath("$.programs[2].built").value(false))
                .andExpect(jsonPath("$.programs[6].prefix").value("600000"));
    }

    @Test
    void sampleImagesAreServed() throws Exception {
        mvc.perform(get("/api/demo/media/1000000001/image-1.svg"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("image/svg+xml"))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("FICTITIOUS DEMO DATA - NOT A REAL PHOTO")));
        mvc.perform(get("/api/demo/media/2000000001/image-1.svg")).andExpect(status().isNotFound());
        mvc.perform(get("/api/demo/media/1000000001/evil.html")).andExpect(status().isNotFound());
    }

    @Test
    void numbersThatAreNotDemoNumbersStillGoToTheNormalRoute() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"9000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.source").value("MANIFEST"));
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"2000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(jsonPath("$.status").value("LIVE_LOOKUP_DISABLED"));
    }
}
