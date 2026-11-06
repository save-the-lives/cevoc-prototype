package cevoc.adapter.in.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class PingControllerTest {

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new PingController()).build();

    @Test
    void answersOkWithoutTouchingAnything() throws Exception {
        mvc.perform(get("/api/ping")).andExpect(status().isOk()).andExpect(content().string("ok"));
    }
}
