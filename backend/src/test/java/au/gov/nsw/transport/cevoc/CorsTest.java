package au.gov.nsw.transport.cevoc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "cevoc.cors.allowed-origins=https://front.example.test")
@AutoConfigureMockMvc
class CorsTest {

    @Autowired MockMvc mvc;

    @Test
    void allowedOriginGetsCorsHeaders() throws Exception {
        mvc.perform(options("/api/penalty-lookups")
                        .header("Origin", "https://front.example.test")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://front.example.test"));
    }

    @Test
    void otherOriginIsRejected() throws Exception {
        mvc.perform(options("/api/penalty-lookups")
                        .header("Origin", "https://evil.example.test")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}
