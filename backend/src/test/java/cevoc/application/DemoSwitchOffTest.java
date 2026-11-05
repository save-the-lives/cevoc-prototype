package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cevoc.adapter.in.web.DemoController;
import cevoc.adapter.out.demo.DemoPenaltyLookupAdapter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Demo data OFF (CEVOC_DEMO_DATA=false): nothing demo exists and a demo number is an ordinary unknown notice. */
@SpringBootTest(properties = "cevoc.demo-data=false")
@AutoConfigureMockMvc
class DemoSwitchOffTest {

    @Autowired MockMvc mvc;
    @Autowired ObjectProvider<DemoPenaltyLookupAdapter> demo;
    @Autowired ObjectProvider<DemoController> controller;

    @Test
    void noDemoBeanIsRegistered() {
        assertThat(demo.getIfAvailable()).isNull();
        assertThat(controller.getIfAvailable()).isNull();
    }

    @Test
    void theHubListAndTheSampleImagesAreUnknownPaths() throws Exception {
        mvc.perform(get("/api/demo/cases")).andExpect(status().isNotFound());
        mvc.perform(get("/api/demo/media/1000000001/image-1.svg")).andExpect(status().isNotFound());
    }

    @Test
    void aDemoNumberBehavesLikeAnyUnknownNotice() throws Exception {
        String demoAnswer = answer("1000000001");
        String unknownAnswer = answer("5551234567");
        assertThat(demoAnswer).contains("LIVE_LOOKUP_DISABLED").doesNotContain("DEMO").doesNotContain("Demo");
        assertThat(demoAnswer.replace("1000000001", "N")).isEqualTo(unknownAnswer.replace("5551234567", "N"));
    }

    private String answer(String number) throws Exception {
        return mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"" + number + "\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }
}
