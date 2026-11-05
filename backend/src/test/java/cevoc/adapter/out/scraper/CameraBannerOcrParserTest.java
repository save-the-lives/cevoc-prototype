package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;

/** Text as an OCR engine might return it (fictitious values). Only timeSinceRed and speedLimit are carried. */
class CameraBannerOcrParserTest {

    private final CameraBannerParser parser = new CameraBannerParser();

    private Map<String, Object> details(String text) {
        return parser.parseOcr(text).asDetails();
    }

    @Test
    void cleanFiveLineBanner() {
        Map<String, Object> d = details("Camera Code: 7109 Direction: North Operator: Sample Roads\nLocation: Sample Road, Sampletown\n"
                + "Incident Number: 6 Lane: 2 Offence: Red light\nSpeed Limit: 70 km/h Time since red: 0.4 s Yellow light duration: 4.0 s\n"
                + "Date: 15/01/2026 Time: 11:12:13");
        assertThat(d).containsEntry("timeSinceRed", 0.4).containsEntry("speedLimit", 70);
    }

    @Test
    void lettersReadAsDigitsAndStrayPunctuationAndSpaces() {
        assertThat(details("Speed Limit: 7O km/h Time since red: O.4 s")).containsEntry("speedLimit", 70).containsEntry("timeSinceRed", 0.4);
        assertThat(details("Speed Limit: lOO km/h Time since red: l.2 s")).containsEntry("speedLimit", 100).containsEntry("timeSinceRed", 1.2);
        assertThat(details("Speed Limit: ~ 60 , km/h Time since red: . 0 , 4 s")).containsEntry("speedLimit", 60);
        assertThat(details("Time since red: 0,4 s")).containsEntry("timeSinceRed", 0.4);
        assertThat(details("Time since red: 0 . 4 s")).containsEntry("timeSinceRed", 0.4);
        assertThat(details("Time since red: 0.4s Speed Limit: 80km/h")).containsEntry("timeSinceRed", 0.4).containsEntry("speedLimit", 80);
        assertThat(details("Time since red: 04 s")).containsEntry("timeSinceRed", 0.4); // decimal point lost
        assertThat(details("Time since red: 12 s")).containsEntry("timeSinceRed", 12.0);
    }

    @Test
    void lostColonsMisspelledLabelsAndRunTogetherWords() {
        assertThat(details("Speed Limit 70 km/h Time since red 0.4 s")).containsEntry("speedLimit", 70).containsEntry("timeSinceRed", 0.4);
        assertThat(details("Speed Lirnit: 70 km/h Tirne since red: 0.4 s")).containsEntry("speedLimit", 70).containsEntry("timeSinceRed", 0.4);
        assertThat(details("SpeedLimit:70km/hTimesincered:0.4sYellowlightduration:4.0s")).containsEntry("speedLimit", 70)
                .containsEntry("timeSinceRed", 0.4);
        assertThat(details("speed limit ; 70 TIME SINCE RED | 0.4")).containsEntry("speedLimit", 70).containsEntry("timeSinceRed", 0.4);
    }

    @Test
    void anyFieldOrderAndMissingFields() {
        assertThat(details("Date: 15/01/2026 Time: 11:12:13 Time since red: 0.4 s Camera Code: 7109"))
                .containsOnlyKeys("timeSinceRed").containsEntry("timeSinceRed", 0.4);
        assertThat(details("Camera Code: 7109 Speed Limit: 70 km/h Yellow light duration: 4.0 s")).containsOnlyKeys("speedLimit");
        assertThat(details("Speed Limit: Time since red: 0.4 s")).containsOnlyKeys("timeSinceRed"); // empty value never borrows the next number
    }

    @Test
    void theYellowDurationAndTimeOfDayAreNeverTakenForTheTwoFields() {
        Map<String, Object> d = details("Yellow light duration: 4.0 s Time: 11:12:13 Date: 15/01/2026");
        assertThat(d).isEmpty();
    }

    @Test
    void garbageNullAndBlankGiveNothingAndNeverThrow() {
        assertThat(details(null)).isEmpty();
        assertThat(details("")).isEmpty();
        assertThat(details("   \n  ")).isEmpty();
        assertThat(details("~~ ;; || .. ,, 0 0 0 Ill lll OOO")).isEmpty();
        assertThat(details("Speed Limit: lll Time since red: OOO")).isEmpty();
        assertThat(details("Time since red: 999 Speed Limit: 5")).isEmpty(); // implausible values are left out
        assertThat(details("Time since red: -1")).isEmpty();
    }

    @Test
    void oneUnreadableFieldDoesNotBreakTheOther() {
        assertThat(details("Speed Limit: ?? km/h Time since red: 0.4 s")).containsOnlyKeys("timeSinceRed");
        assertThat(details("Speed Limit: 70 km/h Time since red: n/a")).containsOnlyKeys("speedLimit");
    }
}
