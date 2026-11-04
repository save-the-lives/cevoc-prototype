package au.gov.nsw.transport.cevoc.livecheck;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Fictitious links only. */
class PublicPathCheckTest {

    private static PenaltyLookupResult result(boolean plateRequired, EvidenceItem... items) {
        return new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, "9000000004", "x", null, List.of(items), "TEST", null,
                List.of(), null, plateRequired);
    }

    private static EvidenceItem image() {
        return new EvidenceItem(EvidenceItem.Kind.IMAGE, "Camera image 1", "/api/media/SECRETTOKENAAAAAAAA",
                "/api/media/SECRETTOKENBBBBBBBB?s=thumb", "/api/media/SECRETTOKENCCCCCCCC?s=medium", 3400, 2706);
    }

    @Test
    void reportsStatusTypeSizeAndCorsForEveryLinkAndNeverTheLinkItself() {
        String text = PublicPathCheck.lines(result(false, image(), image()), url -> new PublicPathCheck.Fetched(200, "image/jpeg; charset=x", 1234, true));
        assertThat(text).contains("public images      : 2").contains("not required").contains("6 of 6 fetched as images")
                .contains("public link 1 full: HTTP 200, image/jpeg, 1234 bytes, cors yes, original 3400x2706 px")
                .contains("public link 2 thumbnail: HTTP 200");
        assertThat(text).doesNotContain("SECRETTOKEN").doesNotContain("/api/media");
    }

    @Test
    void failuresAreCountedNotHidden() {
        String text = PublicPathCheck.lines(result(false, image()), url -> {
            if (url.contains("?s=thumb")) {
                throw new IllegalStateException("boom with a /api/media/SECRETTOKEN link");
            }
            return url.contains("medium") ? new PublicPathCheck.Fetched(404, "text/html", 10, false) : new PublicPathCheck.Fetched(200, "image/jpeg", 5, true);
        });
        assertThat(text).contains("1 of 3 fetched as images").contains("thumbnail: HTTP 0, none, 0 bytes").contains("medium: HTTP 404, text/html");
        assertThat(text).doesNotContain("boom").doesNotContain("SECRETTOKEN");
    }

    @Test
    void anOddContentTypeIsNotEchoed() {
        String text = PublicPathCheck.lines(result(false, image()), url -> new PublicPathCheck.Fetched(200, "X Some <odd> value", 5, false));
        assertThat(text).contains("HTTP 200, other, 5 bytes").doesNotContain("odd");
    }

    @Test
    void noImagesAndTheFlagAreReported() {
        String text = PublicPathCheck.lines(result(true), url -> { throw new AssertionError("nothing to fetch"); });
        assertThat(text).contains("public images      : 0").contains("plate required").contains("none to fetch");
        assertThat(PublicPathCheck.lines(result(false, image()), null)).contains("not checked");
    }
}
