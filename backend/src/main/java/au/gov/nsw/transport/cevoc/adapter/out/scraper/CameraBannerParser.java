package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parses the banner text printed on each evidence image (selectable text, not pixels), for example
 * "Camera Code: ABC123 Direction: North Operator: ... Date: 15/01/2026 Time: 11:12:13".
 * Every field is optional. Red-light-only fields (Time since red, Yellow light duration) are simply
 * null for speed cameras. Pure text in, record out: no network, no HTML.
 */
public class CameraBannerParser {

    /** All fields as written in the banner; null when absent. */
    public record Banner(
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
            String date,
            String time) {

        static Banner empty() {
            return new Banner(null, null, null, null, null, null, null, null, null, null, null, null);
        }
    }

    private static final int MAX_VALUE_LENGTH = 200;
    private static final int MAX_CODE_LENGTH = 40;

    /** Longest labels first so "Time since red" is not read as "Time". */
    private static final String[] LABELS = {
        "Yellow light duration", "Time since red", "Incident Number", "Camera Code", "Speed Limit",
        "Direction", "Operator", "Location", "Offence", "Lane", "Date", "Time"
    };

    private static final Pattern LABEL_ALT = Pattern.compile(
            "(?<![A-Za-z])(Yellow light duration|Time since red|Incident Number|Camera Code|Speed Limit|Direction|Operator|Location|Offence|Lane|Date|Time)\\s*:",
            Pattern.CASE_INSENSITIVE);

    public Banner parse(String text) {
        if (text == null || text.isBlank()) {
            return Banner.empty();
        }
        String normalised = addMissingColons(text.replace(' ', ' '));
        Matcher m = LABEL_ALT.matcher(normalised);
        Map<String, String> found = new HashMap<>();
        String currentLabel = null;
        int valueStart = 0;
        while (m.find()) {
            if (currentLabel != null) {
                found.putIfAbsent(currentLabel, clean(normalised.substring(valueStart, m.start())));
            }
            currentLabel = m.group(1).toLowerCase(Locale.ROOT);
            valueStart = m.end();
        }
        if (currentLabel != null) {
            found.putIfAbsent(currentLabel, clean(normalised.substring(valueStart)));
        }
        String code = found.get("camera code");
        if (code != null && code.length() > MAX_CODE_LENGTH) {
            code = null; // not plausibly a code; the label probably swallowed other text
        }
        return new Banner(
                code,
                found.get("direction"),
                found.get("operator"),
                found.get("location"),
                found.get("incident number"),
                found.get("lane"),
                found.get("offence"),
                found.get("speed limit"),
                found.get("time since red"),
                found.get("yellow light duration"),
                found.get("date"),
                found.get("time"));
    }

    /** Some renderings put the label alone on a line and the value on the next; give those a colon. */
    private static String addMissingColons(String text) {
        StringBuilder out = new StringBuilder();
        for (String line : text.split("\\R", -1)) {
            String t = line.trim();
            boolean bareLabel = false;
            for (String label : LABELS) {
                if (t.equalsIgnoreCase(label)) {
                    bareLabel = true;
                    break;
                }
            }
            out.append(bareLabel ? t + ":" : line).append('\n');
        }
        return out.toString();
    }

    private static String clean(String raw) {
        String v = raw.replaceAll("\\s+", " ").trim();
        if (v.isEmpty()) {
            return null;
        }
        return v.length() > MAX_VALUE_LENGTH ? v.substring(0, MAX_VALUE_LENGTH) : v;
    }
}
