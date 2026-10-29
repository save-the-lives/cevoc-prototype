package au.gov.nsw.transport.cevoc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PenaltyLookupControllerTest {

    @Autowired MockMvc mvc;

    @Test
    void foundWithStubAdapter() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"9000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("FOUND"))
                .andExpect(jsonPath("$.source").value("STUB"));
    }

    @Test
    void unknownNumberReportsLiveLookupOff() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1234567890\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LIVE_LOOKUP_OFF"));
    }

    @Test
    void noMatchIsDistinctFromLiveLookupOff() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"X000000001\",\"offenceDate\":\"2026-09-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_FOUND"));
    }

    @Test
    void rejectsFutureDate() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"1234567890\",\"offenceDate\":\"2999-01-01\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void officerIssuedNoticeHasNoEvidence() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"9000000002\",\"offenceDate\":\"2024-10-23\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notice.enforcementMethod").value("OFFICER_ISSUED"))
                .andExpect(jsonPath("$.notice.noticeStatus").value("CAUTION"))
                .andExpect(jsonPath("$.evidence").isEmpty());
    }

    @Test
    void cameraNoticeHasEvidenceAndCertificate() throws Exception {
        mvc.perform(post("/api/penalty-lookups").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"infringementNumber\":\"9000000003\",\"offenceDate\":\"2018-09-27\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notice.enforcementMethod").value("CAMERA"))
                .andExpect(jsonPath("$.evidence[1].kind").value("CERTIFICATE"));
    }
}
