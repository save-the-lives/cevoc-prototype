package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Reads the selectable text banner printed on evidence images (no OCR). Operates on text only, makes no
 * network call and is not wired into any lookup flow. Accepts one "Label: value" (or "Label value") per line.
 * Tests use fictitious text only.
 */
public class EvidenceBannerParser {

    private static final Pattern CAMERA_CODE = Pattern.compile("\\d{4}");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMMM uuuu", Locale.ENGLISH);
    private static final Pattern TIME = Pattern.compile("(\\d{1,2}):(\\d{2}):(\\d{2})(?:\\.(\\d{1,3}))?");
    private static final String[] LABELS = {
        "Camera Code", "Direction", "Operator", "Location", "Incident Number", "Lane", "Offence",
        "Speed Limit", "Time since red", "Yellow light duration", "Date", "Time"
    };

    public EvidenceBanner parse(String text) {
        if (text == null || text.isBlank()) throw new ScrapeException("Evidence banner text was empty");
        Map<String, String> fields = new HashMap<>();
        for (String raw : text.split("\\R")) {
            String line = raw.strip();
            for (String label : LABELS) {
                if (line.regionMatches(true, 0, label, 0, label.length())) {
                    String rest = line.substring(label.length());
                    if (!rest.isEmpty() && !rest.startsWith(":") && !Character.isWhitespace(rest.charAt(0))) continue;
                    String value = rest.replaceFirst("^[:\\s]+", "").strip();
                    if (!value.isEmpty()) fields.putIfAbsent(label, value);
                    break;
                }
            }
        }
        String code = fields.get("Camera Code");
        if (code == null || !CAMERA_CODE.matcher(code).matches()) {
            throw new ScrapeException("Evidence banner has no four-digit camera code");
        }
        return new EvidenceBanner(code, fields.get("Direction"), fields.get("Operator"), fields.get("Location"),
                fields.get("Incident Number"), fields.get("Lane"), fields.get("Offence"), fields.get("Speed Limit"),
                fields.get("Time since red"), fields.get("Yellow light duration"),
                date(fields.get("Date")), time(fields.get("Time")));
    }

    private static LocalDate date(String v) {
        if (v == null) return null;
        try {
            return LocalDate.parse(v, DATE);
        } catch (DateTimeParseException e) {
            throw new ScrapeException("Evidence banner date was not in 'dd Month yyyy' form");
        }
    }

    private static LocalTime time(String v) {
        if (v == null) return null;
        Matcher m = TIME.matcher(v);
        if (!m.matches()) throw new ScrapeException("Evidence banner time was not in hh:mm:ss.SSS form");
        int millis = m.group(4) == null ? 0 : Integer.parseInt((m.group(4) + "00").substring(0, 3));
        try {
            return LocalTime.of(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)),
                    Integer.parseInt(m.group(3)), millis * 1_000_000);
        } catch (java.time.DateTimeException e) {
            throw new ScrapeException("Evidence banner time was out of range");
        }
    }
}
