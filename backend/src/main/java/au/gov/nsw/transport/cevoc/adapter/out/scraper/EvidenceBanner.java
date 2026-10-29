package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Fields read from the text banner on an evidence image. Pure data: no plate, no notice number.
 * Optional fields are null when the banner did not carry them.
 */
public record EvidenceBanner(
        String cameraCode,
        String direction,
        String operator,
        String location,
        String incidentNumber,
        String lane,
        String offence,
        String speedLimit,
        String timeSinceRed,
        String yellowLightDuration,
        LocalDate offenceDate,
        LocalTime offenceTime) {
}
