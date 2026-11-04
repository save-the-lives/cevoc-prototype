package cevoc.adapter.in.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import cevoc.application.port.out.MediaReadPort;
import cevoc.domain.ImageVariant;
import cevoc.domain.MediaContent;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

/** Fictitious bytes. */
class MediaControllerTest {

    private static final byte[] BYTES = {1, 2, 3, 4};

    private static ObjectProvider<MediaReadPort> provider(MediaReadPort port) {
        return new ObjectProvider<>() {
            @Override public MediaReadPort getObject() { return port; }
            @Override public MediaReadPort getObject(Object... args) { return port; }
            @Override public MediaReadPort getIfAvailable() { return port; }
            @Override public MediaReadPort getIfUnique() { return port; }
        };
    }

    private static MockMvc mvc(MediaReadPort port) {
        return MockMvcBuilders.standaloneSetup(new MediaController(provider(port))).build();
    }

    @Test
    void servesBytesWithTheStoredContentTypeAndCrossOriginHeaders() throws Exception {
        MediaReadPort port = (token, variant) -> "goodtoken000000001".equals(token)
                ? Optional.of(new MediaContent("image/jpeg", BYTES)) : Optional.empty();
        mvc(port).perform(get("/api/media/goodtoken000000001"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"))
                .andExpect(header().string("Cross-Origin-Resource-Policy", "cross-origin"))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("Content-Disposition", "inline"))
                .andExpect(content().bytes(BYTES));
    }

    @Test
    void passesTheRequestedSizeAndAsksForADownloadOnRequest() throws Exception {
        ImageVariant[] seen = new ImageVariant[1];
        MediaReadPort port = (token, variant) -> {
            seen[0] = variant;
            return Optional.of(new MediaContent("image/jpeg", BYTES));
        };
        mvc(port).perform(get("/api/media/goodtoken000000001?s=thumb")).andExpect(status().isOk());
        assertThat(seen[0]).isEqualTo(ImageVariant.THUMBNAIL);
        mvc(port).perform(get("/api/media/goodtoken000000001?s=medium")).andExpect(status().isOk());
        assertThat(seen[0]).isEqualTo(ImageVariant.MEDIUM);
        mvc(port).perform(get("/api/media/goodtoken000000001")).andExpect(status().isOk());
        assertThat(seen[0]).isNull();
        mvc(port).perform(get("/api/media/goodtoken000000001?dl=1"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.startsWith("attachment")));
    }

    @Test
    void unknownTokenAndMissingStorageAreNotFound() throws Exception {
        mvc((t, v) -> Optional.empty()).perform(get("/api/media/unknowntoken0000001")).andExpect(status().isNotFound());
        mvc(null).perform(get("/api/media/unknowntoken0000001")).andExpect(status().isNotFound());
        mvc((t, v) -> Optional.empty()).perform(get("/api/media/short")).andExpect(status().isNotFound());
    }
}
