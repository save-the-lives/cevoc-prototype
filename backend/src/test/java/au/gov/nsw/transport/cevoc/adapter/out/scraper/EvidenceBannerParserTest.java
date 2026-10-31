package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** Fictitious banner text only. No network, no real values. */
class EvidenceBannerParserTest {

    private final EvidenceBannerParser parser = new EvidenceBannerParser();

    private static String fixture() {
        try (InputStream in = EvidenceBannerParserTest.class.getResourceAsStream("/scraper/evidence/fictitious-banner.txt")) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void parsesFictitiousBanner() {
        EvidenceBanner b = parser.parse(fixture());
        assertEquals("0000", b.cameraCode());
        assertEquals("Northbound", b.direction());
        assertEquals("Example Road northbound at the intersection with Sample Street, EXAMPLETOWN", b.location());
        assertEquals("000000", b.incidentNumber());
        assertEquals(LocalDate.of(2024, 3, 5), b.offenceDate());
        assertEquals(LocalTime.of(14, 7, 9, 123_000_000), b.offenceTime());
    }

    @Test
    void missingOptionalFieldsAreNull() {
        EvidenceBanner b = parser.parse("Camera Code 1234\nDate: 1 January 2024");
        assertEquals("1234", b.cameraCode());
        assertNull(b.lane());
        assertNull(b.offenceTime());
        assertEquals(LocalDate.of(2024, 1, 1), b.offenceDate());
    }

    @Test
    void timeLabelDoesNotSwallowTimeSinceRed() {
        EvidenceBanner b = parser.parse("Camera Code: 1234\nTime since red: 0.5 s\nTime: 01:02:03.5");
        assertEquals("0.5 s", b.timeSinceRed());
        assertEquals(LocalTime.of(1, 2, 3, 500_000_000), b.offenceTime());
    }

    @Test
    void rejectsBadInput() {
        assertThrows(ScrapeException.class, () -> parser.parse(""));
        assertThrows(ScrapeException.class, () -> parser.parse("Direction: North"));
        assertThrows(ScrapeException.class, () -> parser.parse("Camera Code: 12\nDate: 1 January 2024"));
        assertThrows(ScrapeException.class, () -> parser.parse("Camera Code: 1234\nDate: tomorrow"));
        assertThrows(ScrapeException.class, () -> parser.parse("Camera Code: 1234\nTime: 25:00:00"));
    }
}
