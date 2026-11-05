package cevoc.adapter.out.ocr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import cevoc.adapter.out.scraper.CameraBannerParser;
import cevoc.application.port.out.BannerTextReaderPort;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 * Needs the tesseract program. Where it is absent the tests are skipped on a developer machine, but they FAIL in CI (the CI
 * job installs tesseract-ocr), so a broken install cannot hide. Banners are drawn in the test with made-up values.
 */
class TesseractBannerTextReaderTest {

    private static final TesseractBannerTextReader READER = new TesseractBannerTextReader("tesseract", Duration.ofSeconds(60));
    private final CameraBannerParser parser = new CameraBannerParser();

    @BeforeAll
    static void engineIsThere() {
        boolean present;
        try {
            Process p = new ProcessBuilder("tesseract", "--version").redirectErrorStream(true).start();
            p.getInputStream().readAllBytes();
            present = p.waitFor() == 0;
        } catch (Exception e) {
            present = false;
        }
        if ("true".equalsIgnoreCase(System.getenv("CI"))) {
            assertThat(present).as("tesseract must be installed in CI (apt-get install -y tesseract-ocr)").isTrue();
        } else {
            assumeTrue(present, "tesseract is not installed here");
        }
    }

    private java.util.Map<String, Object> read(int w, int h, List<String> lines) {
        BannerTextReaderPort.Reading r = READER.read(FictitiousBanners.jpeg(w, h, lines));
        assertThat(r.engineFailed()).isFalse();
        assertThat(r.lines()).isGreaterThanOrEqualTo(lines.size() - 1);
        return parser.parseOcr(r.text()).asDetails();
    }

    @Test
    void readsBothFieldsFromAFullSizeBanner() {
        assertThat(read(3400, 2706, FictitiousBanners.lines("70", "0.4"))).containsEntry("speedLimit", 70).containsEntry("timeSinceRed", 0.4);
    }

    @Test
    void readsSmallerImagesAndOtherValues() {
        assertThat(read(1700, 1350, FictitiousBanners.lines("100", "1.2"))).containsEntry("speedLimit", 100).containsEntry("timeSinceRed", 1.2);
        assertThat(read(1000, 800, FictitiousBanners.lines("60", "0.8"))).containsEntry("speedLimit", 60).containsEntry("timeSinceRed", 0.8);
    }

    @Test
    void aMissingFieldIsAbsentAndTheOtherIsStillRead() {
        assertThat(read(1700, 1350, FictitiousBanners.lines(null, "0.4"))).containsOnlyKeys("timeSinceRed");
        assertThat(read(1700, 1350, FictitiousBanners.lines("70", null))).containsOnlyKeys("speedLimit");
    }

    @Test
    void differentFieldOrderIsRead() {
        List<String> lines = List.of("Date: 15/01/2026 Time: 11:12:13", "Time since red: 0.4 s Speed Limit: 70 km/h",
                "Camera Code: 7109 Lane: 2", "Location: Sample Road, Sampletown", "Offence: Red light Incident Number: 6");
        assertThat(read(1700, 1350, lines)).containsEntry("speedLimit", 70).containsEntry("timeSinceRed", 0.4);
    }

    @Test
    void notAnImageOrAMissingProgramGivesNoTextAndNoException() {
        assertThat(READER.read(new byte[] {1, 2, 3}).text()).isEmpty();
        assertThat(READER.read(null).engineFailed()).isTrue();
        BannerTextReaderPort.Reading r = new TesseractBannerTextReader("no-such-ocr-program", Duration.ofSeconds(5))
                .read(FictitiousBanners.jpeg(600, 400, FictitiousBanners.lines("70", "0.4")));
        assertThat(r.engineFailed()).isTrue();
        assertThat(r.text()).isEmpty();
        assertThat(r.toString()).doesNotContain("7109");
    }

    @Test
    void aPhotoWithoutABannerGivesNothingUsable() {
        assertThat(read0(FictitiousBanners.jpeg(1000, 800, List.of()))).isEmpty();
    }

    private java.util.Map<String, Object> read0(byte[] image) {
        return parser.parseOcr(READER.read(image).text()).asDetails();
    }
}
