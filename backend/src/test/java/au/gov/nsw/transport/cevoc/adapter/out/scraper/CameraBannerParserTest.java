package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** FICTITIOUS banner text only. */
class CameraBannerParserTest {

    private final CameraBannerParser parser = new CameraBannerParser();

    @Test
    void readsAllFieldsOfARedLightBanner() {
        CameraBannerParser.Banner b = parser.parse("Camera Code: TST001 Direction: North Operator: Fictitious Operator "
                + "Location: SAMPLE ROAD Incident Number: 000001 Lane: 2 Offence: Red light Speed Limit: 60 "
                + "Time since red: 1.2 sec Yellow light duration: 4.0 sec Date: 15/01/2026 Time: 11:12:13");
        assertThat(b.cameraCode()).isEqualTo("TST001");
        assertThat(b.direction()).isEqualTo("North");
        assertThat(b.operator()).isEqualTo("Fictitious Operator");
        assertThat(b.location()).isEqualTo("SAMPLE ROAD");
        assertThat(b.incidentNumber()).isEqualTo("000001");
        assertThat(b.lane()).isEqualTo("2");
        assertThat(b.offence()).isEqualTo("Red light");
        assertThat(b.speedLimit()).isEqualTo("60");
        assertThat(b.timeSinceRed()).isEqualTo("1.2 sec");
        assertThat(b.yellowLightDuration()).isEqualTo("4.0 sec");
        assertThat(b.date()).isEqualTo("15/01/2026");
        assertThat(b.time()).isEqualTo("11:12:13");
    }

    @Test
    void speedCameraBannerLeavesRedLightFieldsNull() {
        CameraBannerParser.Banner b = parser.parse("Camera Code: TST777 Direction: South Offence: Speed Speed Limit: 80 Date: 03/02/2026 Time: 21:05:00");
        assertThat(b.cameraCode()).isEqualTo("TST777");
        assertThat(b.timeSinceRed()).isNull();
        assertThat(b.yellowLightDuration()).isNull();
        assertThat(b.time()).isEqualTo("21:05:00");
    }

    @Test
    void toleratesLineBreaksBareLabelsAndCase() {
        CameraBannerParser.Banner b = parser.parse("camera code\nTST002\nDATE:\n15/01/2026\nTime\n11:12");
        assertThat(b.cameraCode()).isEqualTo("TST002");
        assertThat(b.date()).isEqualTo("15/01/2026");
        assertThat(b.time()).isEqualTo("11:12");
    }

    @Test
    void timeSinceRedIsNotReadAsTime() {
        CameraBannerParser.Banner b = parser.parse("Time since red: 0.8 sec");
        assertThat(b.timeSinceRed()).isEqualTo("0.8 sec");
        assertThat(b.time()).isNull();
    }

    @Test
    void missingOrEmptyInputGivesAllNulls() {
        assertThat(parser.parse(null).cameraCode()).isNull();
        assertThat(parser.parse("   ").cameraCode()).isNull();
        assertThat(parser.parse("nothing useful here").cameraCode()).isNull();
        assertThat(parser.parse("Camera Code: Direction: North").cameraCode()).isNull();
        assertThat(parser.parse("Camera Code: Direction: North").direction()).isEqualTo("North");
    }

    @Test
    void implausiblyLongCodeIsDropped() {
        assertThat(parser.parse("Camera Code: " + "X".repeat(60)).cameraCode()).isNull();
    }
}
