package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

class BrowserHeadersTest {

    private static final String PAGE = "https://search.example.invalid/cevoc/pages/searchCertificates.jsf";

    @Test
    void theFirstRequestLooksLikeATypedAddressNavigation() {
        Map<String, String> h = BrowserHeaders.forGet();
        assertThat(h.get("User-Agent")).startsWith("Mozilla/5.0").contains("Chrome/").doesNotContain("Headless");
        assertThat(h).containsEntry("Accept-Language", "en-AU,en;q=0.9")
                .containsEntry("Sec-Fetch-Site", "none")
                .containsEntry("Sec-Fetch-Mode", "navigate")
                .containsEntry("Sec-Fetch-Dest", "document")
                .containsEntry("Sec-Fetch-User", "?1")
                .containsEntry("Upgrade-Insecure-Requests", "1")
                .doesNotContainKeys("Referer", "Origin");
        assertThat(h.get("Accept")).startsWith("text/html,application/xhtml+xml");
    }

    @Test
    void noGzipIsRequestedBecauseTheClientCannotDecodeIt() {
        assertThat(BrowserHeaders.forGet()).containsEntry("Accept-Encoding", "gzip");
    }

    @Test
    void theFormPostIsSameOriginWithTheFormPageAsReferrer() {
        Map<String, String> h = BrowserHeaders.forFormPost(PAGE, "https://search.example.invalid/cevoc/pages/searchCertificates.jsf;jsessionid=X");
        assertThat(h).containsEntry("Sec-Fetch-Site", "same-origin")
                .containsEntry("Referer", PAGE)
                .containsEntry("Origin", "https://search.example.invalid");
    }

    @Test
    void theUserAgentMatchesTheClientHintsPlatform() {
        assertThat(BrowserHeaders.USER_AGENT).contains("Linux");
        assertThat(BrowserHeaders.forGet().get("sec-ch-ua-platform")).isEqualTo("\"Linux\"");
    }
}
