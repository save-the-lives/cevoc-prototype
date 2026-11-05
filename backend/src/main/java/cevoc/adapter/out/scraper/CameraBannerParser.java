package cevoc.adapter.out.scraper;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
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

        /** Seconds the light had been red, from text like "1.2 sec"; null when absent or not a plausible number. */
        public Double timeSinceRedSeconds() {
            String t = numberText(timeSinceRed);
            if (t != null && t.matches("0\\d+")) {
                t = "0." + t.substring(1); // "04": the decimal point was lost, a leading-zero whole number is never printed
            }
            Double v = t == null ? null : Double.valueOf(t);
            return v != null && v >= 0 && v <= 60 ? v : null;
        }

        /** Speed limit in km/h, from text like "60" or "60 km/h"; null when absent or not plausible. */
        public Integer speedLimitKmh() {
            Double v = firstNumber(speedLimit);
            return v != null && v >= 10 && v <= 130 ? Integer.valueOf((int) Math.round(v)) : null;
        }

        /**
         * The typed facts the page shows (decision record 0009), as a stable-keyed map: {@code timeSinceRed} in seconds and
         * {@code speedLimit} in km/h, both numbers. Each is left out on its own when absent or unreadable. Other banner fields are
         * parsed but not carried until the page shows them.
         */
        public Map<String, Object> asDetails() {
            Map<String, Object> out = new LinkedHashMap<>();
            Double red = timeSinceRedSeconds();
            if (red != null) {
                out.put("timeSinceRed", red);
            }
            Integer limit = speedLimitKmh();
            if (limit != null) {
                out.put("speedLimit", limit);
            }
            return out;
        }

        /** Number of fields that were read (used for counts in diagnostics only). */
        public int fieldCount() {
            int n = 0;
            for (String f : new String[] {cameraCode, direction, operator, location, incidentNumber, lane, offence, speedLimit,
                timeSinceRed, yellowLightDuration, date, time}) {
                n += f == null ? 0 : 1;
            }
            return n;
        }

        private static Double firstNumber(String text) {
            String t = numberText(text);
            return t == null ? null : Double.valueOf(t);
        }

        /**
         * The first number in the text as plain digits with a dot, tolerant of OCR noise: O/o read as 0, l/I/| read as 1,
         * a comma or a stray space around the decimal separator. A token needs a real digit (apart from lO and lOO). A directly
         * preceding hyphen is kept out (a negative value stays implausible).
         */
        static String numberText(String text) {
            if (text == null) {
                return null;
            }
            Matcher m = NUMBER.matcher(text);
            while (m.find()) {
                String whole = m.group(1);
                String frac = m.group(2);
                // Letters alone are words; a whole part with no real digit counts only as lO or lOO (10, 100) read as letters.
                if (!(whole + (frac == null ? "" : frac)).matches(".*[0-9].*") && !whole.matches("[lI|][Oo]{1,2}")) {
                    continue;
                }
                String n = fix(whole) + (frac == null ? "" : "." + fix(frac));
                return n;
            }
            return null;
        }

        private static String fix(String s) {
            return s.replace('O', '0').replace('o', '0').replace('l', '1').replace('I', '1').replace('|', '1');
        }
    }

    private static final Pattern NUMBER = Pattern.compile(
            "(?<![A-Za-z0-9-])([0-9OolI|]+)(?:\\s?[.,]\\s?([0-9OolI|]+))?(?![0-9OolI|])");

    private static final int MAX_VALUE_LENGTH = 200;
    private static final int MAX_CODE_LENGTH = 40;

    /** Longest labels first so "Time since red" is not read as "Time". */
    private static final String[] LABELS = {
        "Yellow light duration", "Time since red", "Incident Number", "Camera Code", "Speed Limit",
        "Direction", "Operator", "Location", "Offence", "Lane", "Date", "Time"
    };

    private static final Pattern LABEL_ALT = Pattern.compile(
            "(?<![A-Za-z])(" + String.join("|", LABELS).replace(" ", "\\s+") + ")\\s*:", Pattern.CASE_INSENSITIVE);

    /**
     * Fields of one OCR label with a tolerant spelling (OCR confuses i/l/1, m/rn, o/0) and the form it is rewritten to. Longest
     * first. The separator after the label is optional because OCR often loses the colon.
     */
    private static final String[][] OCR_LABELS = {
        {"Yellow light duration", "Y[eo]l+[o0]w\\s*l[il1|]ght\\s*d[uo]r[a-z]{3,6}"},
        {"Time since red", "T[il1|](?:m|rn)[eo]\\s*s[il1|]nc[eo]\\s*r[eo]d"},
        {"Incident Number", "[Il1|]nc[il1|]dent\\s*N[uo](?:m|rn)ber"},
        {"Camera Code", "Camera\\s*C[o0]de"},
        {"Speed Limit", "Sp[eo]{2}d\\s*L[il1|](?:m|rn)[il1|]t"},
        {"Direction", "D[il1|]rect[il1|][o0]n"},
        {"Operator", "Operat[o0]r"},
        {"Location", "L[o0]cat[il1|][o0]n"},
        {"Offence", "Offenc[eo]"},
        {"Lane", "Lane"},
        {"Date", "Date"},
        {"Time", "T[il1|](?:m|rn)e(?!\\s*s[il1|]nc)"}
    };

    private static final List<Pattern> OCR_PATTERNS = new java.util.ArrayList<>();

    static {
        for (String[] l : OCR_LABELS) {
            // Multi-word labels may run into their neighbours when OCR drops the spaces ("km/hTimesincered"); one-word labels may not.
            boolean multi = l[0].contains(" ");
            OCR_PATTERNS.add(Pattern.compile((multi ? "" : "(?<![A-Za-z])") + "(?:" + l[1] + ")" + (multi ? "" : "(?![A-Za-z])")
                    + "\\s*[:;.,|]?\\s*", Pattern.CASE_INSENSITIVE));
        }
    }

    /**
     * Parses text read from the banner pixels by OCR. Label spellings are matched tolerantly and a lost colon is restored, then
     * the ordinary parser makes the fields; numbers are read with OCR tolerance (see {@link Banner}). Never throws.
     */
    public Banner parseOcr(String text) {
        if (text == null || text.isBlank()) {
            return Banner.empty();
        }
        String t = text.replace(' ', ' ').replaceAll("\\s+", " ");
        for (int i = 0; i < OCR_PATTERNS.size(); i++) {
            String canon = " " + OCR_LABELS[i][0] + ": ";
            t = OCR_PATTERNS.get(i).matcher(t).replaceAll(r -> Matcher.quoteReplacement(canon));
        }
        return parse(t);
    }

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
            currentLabel = m.group(1).replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
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
