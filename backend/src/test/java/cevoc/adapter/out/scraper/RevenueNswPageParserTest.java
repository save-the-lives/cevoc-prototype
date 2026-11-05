package cevoc.adapter.out.scraper;

import static cevoc.adapter.out.scraper.FakeRenderedPageSession.fixture;
import static org.assertj.core.api.Assertions.assertThat;

import cevoc.domain.EnforcementMethod;
import cevoc.domain.NoticeStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** FICTITIOUS fixtures only (notice 9000000004, plate TST123, camera code 7109, incident 6). */
class RevenueNswPageParserTest {

    private final RevenueNswPageParser parser = new RevenueNswPageParser();

    @Test
    void state1LoginPageIsRecognisedFromItsInputs() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state1-login.html"));
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.LOGIN);
        assertThat(p.unexpectedLoginFields()).isEmpty(); // lastName, firstName, organisation are all disabled
        assertThat(p.notice()).isNull();
    }

    @Test
    void loginPageThatLabelsItsFieldPenaltyNoticeNumberIsStillLogin() {
        String html = "<html><body><label>Penalty Notice Number: Date of offence: 01/01/2026</label>"
                + "<input name=\"pnn\"><input name=\"dateOfOffence\"><button>Next</button></body></html>";
        assertThat(parser.parse(html).state()).isEqualTo(RevenueNswPageParser.State.LOGIN);
    }

    @Test
    void loginInputsIdentifiedByIdOrFormcontrolnameAreStillLogin() {
        String byId = "<html><body><input id=\"pnn\"><input id=\"dateOfOffence\"><button>Next</button></body></html>";
        String byControl = "<html><body><input formcontrolname=\"pnn\"><input formcontrolname=\"dateOfOffence\"></body></html>";
        assertThat(parser.parse(byId).state()).isEqualTo(RevenueNswPageParser.State.LOGIN);
        assertThat(parser.parse(byControl).state()).isEqualTo(RevenueNswPageParser.State.LOGIN);
    }

    @Test
    void state1WithAnEnabledNameFieldIsFlagged() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state1-login-needs-name.html"));
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.LOGIN);
        assertThat(p.unexpectedLoginFields()).containsExactly("lastName");
    }

    @Test
    void state2SummaryReadsRowsByLabelAndFindsThePlateForm() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state2-summary.html"));
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.SUMMARY);
        assertThat(p.noticeNumber()).isEqualTo("9000000004");
        assertThat(p.notice().offenceDate()).isEqualTo(LocalDate.of(2026, 1, 15));
        assertThat(p.notice().offenceTime()).isEqualTo(LocalTime.of(11, 12));
        assertThat(p.notice().offenceDescription()).isEqualTo("Camera recorded");
        assertThat(p.notice().location()).isEqualTo("SAMPLE ROAD, SAMPLETOWN"); // free text, not a code
        assertThat(p.notice().penaltyAmount()).isEqualByComparingTo("277.00");
        assertThat(p.notice().amountOwing()).isEqualByComparingTo("277.00");
        assertThat(p.notice().noticeStatus()).isEqualTo(NoticeStatus.PAYABLE);
        assertThat(p.notice().enforcementMethod()).isEqualTo(EnforcementMethod.CAMERA); // "Camera recorded"
        assertThat(p.plateFormPresent()).isTrue();
        assertThat(p.registrationRowPresent()).isFalse();
        assertThat(p.registrationRequiredShown()).isFalse();
        assertThat(p.images()).isEmpty();
        assertThat(p.cameraCode()).isNull();
    }

    @Test
    void offenceTextThatSaysCameraRecordedMapsToCameraAndOtherTextStaysUnknown() {
        assertThat(RevenueNswPageParser.methodOf("Camera recorded")).isEqualTo(EnforcementMethod.CAMERA);
        assertThat(RevenueNswPageParser.methodOf("  SAMPLE: camera recorded - sample offence ")).isEqualTo(EnforcementMethod.CAMERA);
        assertThat(RevenueNswPageParser.methodOf("Park continuously for longer than indicated")).isEqualTo(EnforcementMethod.UNKNOWN);
        assertThat(RevenueNswPageParser.methodOf(null)).isEqualTo(EnforcementMethod.UNKNOWN);
    }

    @Test
    void state2PaidNoticeHasNothingOwing() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state2-summary-paid.html"));
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.SUMMARY);
        assertThat(p.notice().noticeStatus()).isEqualTo(NoticeStatus.PAID);
        assertThat(p.notice().amountOwing()).isEqualByComparingTo("0");
        assertThat(p.plateFormPresent()).isFalse();
    }

    @Test
    void state2ShowsTheRegistrationRequiredMessage() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state2-required.html"));
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.SUMMARY);
        assertThat(p.plateFormPresent()).isTrue();
        assertThat(p.registrationRequiredShown()).isTrue();
    }

    @Test
    void state3ReadsImagesBannerCameraCodeAndCertificateLink() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state3-images.html"));
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.IMAGES);
        assertThat(p.plateFormPresent()).isFalse();
        assertThat(p.registrationRowPresent()).isTrue();
        assertThat(p.notice().enforcementMethod()).isEqualTo(EnforcementMethod.CAMERA);
        assertThat(p.notice().location()).isEqualTo("SAMPLE ROAD, SAMPLETOWN"); // not the banner's Location
        // large image and its thumbnail share a ref, so three distinct images
        assertThat(p.images()).extracting(RevenueNswPageParser.ImageRef::ref)
                .containsExactly("700-1-000000001", "700-1-000000002", "700-1-000000003");
        assertThat(p.images()).allMatch(i -> i.blobUrl().startsWith("blob:"));
        assertThat(p.downloadImagesPresent()).isTrue();
        assertThat(p.cameraCode()).isEqualTo("7109");
        assertThat(p.certification().notice()).isEqualTo("9000000004");
        assertThat(p.certification().offenceDateTime()).isEqualTo("15/01/2026 11:12:13");
        assertThat(p.certification().cameraCode()).isEqualTo("7109");
        assertThat(p.certification().incidentNumber()).isEqualTo("6");
    }

    @Test
    void cameraCodeFallsBackToTheCertificateLinkWhenThereIsNoBanner() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state3-no-banner.html"));
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.IMAGES);
        assertThat(p.cameraCode()).isEqualTo("7109");
        assertThat(p.images()).hasSize(1);
        assertThat(p.downloadImagesPresent()).isFalse();
    }

    @Test
    void theSignedCertificateValueAndThePlateAreNeverKept() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state3-images.html"));
        String everything = p.toString();
        assertThat(everything).doesNotContain("0123456789abcdef0123456789abcdef").doesNotContain("TST123");
        assertThat(java.util.Arrays.stream(RevenueNswPageParser.CertificationRef.class.getRecordComponents())
                .map(c -> c.getName())).doesNotContain("m", "signature", "href", "url");
    }

    @Test
    void statesAreKeyedOnPresenceNotOrder() {
        // Same content as state 3 with the sections shuffled: details after images, link first.
        String html = "<body>"
                + "<a href=\"certificateDetails.jsf?p=9000000004&s=7109&i=6&m=abc\">View certification details</a>"
                + "<img src=\"blob:x/1\" alt=\"700-1-000000001\">"
                + "<div><span>Registration number:</span><span>TST123</span></div>"
                + "<div><span>Location:</span><span>SAMPLE ROAD</span></div>"
                + "<div><span>Penalty Amount:</span><span>$10.00</span></div>"
                + "<div><span>Offence Description:</span><span>Test</span></div>"
                + "<div><span>Offence Time:</span><span>1:05 pm</span></div>"
                + "<div><span>Date of offence:</span><span>15/01/2026</span></div>"
                + "<h2>Penalty Notice Number - 9000000004</h2></body>";
        RevenueNswPageParser.Page p = parser.parse(html);
        assertThat(p.state()).isEqualTo(RevenueNswPageParser.State.IMAGES);
        assertThat(p.notice().offenceTime()).isEqualTo(LocalTime.of(13, 5));
        assertThat(p.cameraCode()).isEqualTo("7109");
    }

    @Test
    void garbageAndUnreadableFieldsAreUnrecognisedNotGuessed() {
        assertThat(parser.parse("<html>site redesigned</html>").state()).isEqualTo(RevenueNswPageParser.State.UNRECOGNISED);
        assertThat(parser.parse("").state()).isEqualTo(RevenueNswPageParser.State.UNRECOGNISED);
        assertThat(parser.parse(null).state()).isEqualTo(RevenueNswPageParser.State.UNRECOGNISED);
        String bad = "<div><span>Date of offence:</span><span>not a date</span></div><div><span>Penalty Amount:</span><span>$10</span></div>";
        assertThat(parser.parse(bad).state()).isEqualTo(RevenueNswPageParser.State.UNRECOGNISED);
    }

    @Test
    void imagesStateKeepsTheTypedBannerFactsOfTheFirstImage() {
        RevenueNswPageParser.Page p = parser.parse(fixture("fictitious-state3-images.html"));
        assertThat(p.details()).containsOnlyKeys("timeSinceRed", "speedLimit");
        assertThat(p.details().get("timeSinceRed")).isEqualTo(1.2);
        assertThat(p.details().get("speedLimit")).isEqualTo(60);
    }

    @Test
    void bannerTextOutsideBannerElementsIsStillReadFromTheFirstCameraCodeOnward() {
        String html = fixture("fictitious-state3-images.html").replace("<figcaption class=\"banner\">", "<p class=\"cap\">")
                .replace("</figcaption>", "</p>");
        assertThat(html).doesNotContain("figcaption");
        java.util.Map<String, Object> d = parser.parse(html).details();
        assertThat(d.get("timeSinceRed")).isEqualTo(1.2);
        assertThat(d.get("speedLimit")).isEqualTo(60);
    }

    @Test
    void summaryStateHasNoBannerDetails() {
        assertThat(parser.parse(fixture("fictitious-state2-summary.html")).details()).isEmpty();
    }
}
