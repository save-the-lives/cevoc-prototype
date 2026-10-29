package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** FICTITIOUS fixtures only. */
class RevenueNswPageParserTest {

    private final RevenueNswPageParser parser = new RevenueNswPageParser();

    static String fixture(String name) throws IOException {
        return Files.readString(Path.of("src/test/resources/fixtures/scraper/" + name), StandardCharsets.UTF_8);
    }

    @Test
    void readsStepOneResultPageAndFindsTheImagesForm() throws IOException {
        RevenueNswPageParser.Parsed p = parser.parse(fixture("fictitious-penalty-result.html"));
        assertThat(p.outcome()).isEqualTo(RevenueNswPageParser.Outcome.FOUND);
        assertThat(p.notice().offenceDate()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(p.notice().offenceTime()).isEqualTo(LocalTime.of(11, 12));
        assertThat(p.notice().offenceDescription()).isEqualTo("Camera recorded");
        assertThat(p.notice().location()).isEqualTo("SAMPLE ROAD, SAMPLETOWN");
        assertThat(p.notice().penaltyAmount()).isEqualByComparingTo("277.00");
        assertThat(p.notice().amountOwing()).isEqualByComparingTo("277.00");
        assertThat(p.notice().noticeStatus()).isEqualTo(NoticeStatus.PAYABLE);
        assertThat(p.notice().statusMessage()).contains("payable & can");
        assertThat(p.notice().enforcementMethod()).isEqualTo(EnforcementMethod.UNKNOWN);
        assertThat(p.imagesStep()).isNotNull();
        assertThat(p.imagesStep().action()).isEqualTo("/fixture/images");
        assertThat(p.imagesStep().registrationField()).isEqualTo("registration");
        assertThat(p.imagesStep().fixedFields()).containsEntry("token", "fixture-token").containsEntry("viewImages", "1")
                .doesNotContainKey("registration");
    }

    @Test
    void readsPaidNoticeWithInlineLabelsAndTwelveHourTime() throws IOException {
        RevenueNswPageParser.Parsed p = parser.parse(fixture("fictitious-penalty-paid.html"));
        assertThat(p.outcome()).isEqualTo(RevenueNswPageParser.Outcome.FOUND);
        assertThat(p.notice().offenceDate()).isEqualTo(LocalDate.of(2026, 2, 3));
        assertThat(p.notice().offenceTime()).isEqualTo(LocalTime.of(21, 5));
        assertThat(p.notice().noticeStatus()).isEqualTo(NoticeStatus.PAID);
        assertThat(p.notice().amountOwing()).isEqualByComparingTo("0");
        assertThat(p.imagesStep()).isNull();
    }

    @Test
    void notFoundAndGarbage() throws IOException {
        assertThat(parser.parse(fixture("fictitious-no-match.html")).outcome()).isEqualTo(RevenueNswPageParser.Outcome.NOT_FOUND);
        assertThat(parser.parse("<html>site redesigned</html>").outcome()).isEqualTo(RevenueNswPageParser.Outcome.UNRECOGNISED);
        assertThat(parser.parse("").outcome()).isEqualTo(RevenueNswPageParser.Outcome.UNRECOGNISED);
        assertThat(parser.parse(null).outcome()).isEqualTo(RevenueNswPageParser.Outcome.UNRECOGNISED);
    }

    @Test
    void resultPageWithAnUnreadableFieldIsUnrecognisedNotGuessed() {
        String html = "<p>Date of offence</p><p>not a date</p><p>Penalty Amount</p><p>$10</p>";
        assertThat(parser.parse(html).outcome()).isEqualTo(RevenueNswPageParser.Outcome.UNRECOGNISED);
    }

    @Test
    void readsImagesPageWithCameraCodeAndCertificationLink() throws IOException {
        RevenueNswPageParser.ImagesPage page = parser.parseImages(fixture("fictitious-images.html"));
        assertThat(page.media()).hasSize(3);
        assertThat(page.media().get(0).src()).isEqualTo("/fixture-media/image-1.jpg");
        assertThat(page.media().get(0).title()).isEqualTo("Camera image 700-1-000000001");
        assertThat(page.cameraCode()).isEqualTo("TST001");
        assertThat(page.certificationUrl()).isEqualTo("/fixture/certification");
    }

    @Test
    void speedCameraImagesPageStillGivesCameraCode() throws IOException {
        RevenueNswPageParser.ImagesPage page = parser.parseImages(fixture("fictitious-images-speed.html"));
        assertThat(page.media()).hasSize(1);
        assertThat(page.cameraCode()).isEqualTo("TST777");
        assertThat(page.certificationUrl()).isNull();
    }

    @Test
    void emptyImagesPageGivesNothing() {
        RevenueNswPageParser.ImagesPage page = parser.parseImages("<html>nothing</html>");
        assertThat(page.media()).isEmpty();
        assertThat(page.cameraCode()).isNull();
        assertThat(parser.parseImages(null).media()).isEmpty();
    }
}
