package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The ONLY class that knows what the penalty pages look like. Follows the real two-step flow:
 * <ol>
 *   <li>Step 1, the penalty result page ({@link #parse}): Date of offence, Offence Time, Offence Description,
 *       Demerit Points, Penalty Amount, Location (street and suburb only), Amount owing and a paid/payable
 *       notice. It also holds the Images section, which needs the vehicle registration plus a "View images"
 *       action ({@link ImagesStep}).</li>
 *   <li>Step 2, the images page ({@link #parseImages}): image items (refs like 700-1-000000001), a
 *       "Download Images" button, "View certification details", and per image banner text that
 *       {@link CameraBannerParser} reads (the camera code is the key output).</li>
 * </ol>
 * The step 1 fields are read by their visible labels (all tags flattened to lines), which survives most
 * markup changes. The images page and the form are read from markup, and that markup is a GUESS: the owner
 * supplied screenshots only, so the fixtures in src/test/resources/fixtures/scraper are FICTITIOUS.
 * TODO (needs saved real page source with personal data removed): the form action and field names, the image
 * item markup, the exact banner layout, how "not found" is shown.
 *
 * The vehicle registration is never read, held or logged here; this class only finds the name of the form field
 * that takes it.
 */
public class RevenueNswPageParser {

    public enum Outcome { FOUND, NOT_FOUND, UNRECOGNISED }

    /** A media reference as written in the page (src may be relative). */
    public record MediaRef(EvidenceItem.Kind kind, String title, String src) {}

    /**
     * The "View images" form on the result page. {@code fixedFields} are the hidden inputs and the button
     * that must be sent back; {@code registrationField} is the name of the (empty) plate input.
     */
    public record ImagesStep(String action, String registrationField, Map<String, String> fixedFields) {}

    public record Parsed(Outcome outcome, NoticeDetails notice, ImagesStep imagesStep) {
        static Parsed of(Outcome o) {
            return new Parsed(o, null, null);
        }
    }

    /** The page after "View images". {@code cameraCode} is the first code found on any image banner. */
    public record ImagesPage(List<MediaRef> media, String cameraCode, String certificationUrl) {}

    private static final String L_DATE = "Date of offence";
    private static final String L_TIME = "Offence Time";
    private static final String L_DESC = "Offence Description";
    private static final String L_DEMERIT = "Demerit Points";
    private static final String L_PENALTY = "Penalty Amount";
    private static final String L_LOCATION = "Location";
    private static final String L_OWING = "Amount owing";
    private static final List<String> LABELS = List.of(L_DATE, L_TIME, L_DESC, L_DEMERIT, L_PENALTY, L_LOCATION, L_OWING);

    private static final Pattern NO_MATCH = Pattern.compile("id=\"no-match\"");
    private static final Pattern STATUS_LINE = Pattern.compile(
            "(?i)\\b(has been paid|is paid|payable|payment (is )?due|overdue|caution|no payment)\\b");
    private static final Pattern FORM = Pattern.compile("<form\\b([^>]*)>(.*?)</form>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern INPUT = Pattern.compile("<input\\b[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern BUTTON = Pattern.compile("<button\\b([^>]*)>(.*?)</button>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern IMAGE_ITEM = Pattern.compile(
            "<figure\\b[^>]*\\bclass=\"[^\"]*\\bimage-item\\b[^\"]*\"[^>]*>(.*?)</figure>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern IMG_TAG = Pattern.compile("<img\\b[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern BANNER = Pattern.compile(
            "<figcaption\\b[^>]*\\bclass=\"[^\"]*\\bbanner\\b[^\"]*\"[^>]*>(.*?)</figcaption>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern REF = Pattern.compile("\\b\\d{1,4}-\\d{1,3}-\\d{4,12}\\b");
    private static final Pattern ANCHOR = Pattern.compile("<a\\b([^>]*)>(.*?)</a>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final List<DateTimeFormatter> DATES = List.of(
            DateTimeFormatter.ofPattern("d/M/uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("d MMMM uuuu", Locale.ENGLISH),
            DateTimeFormatter.ISO_LOCAL_DATE);
    private static final List<DateTimeFormatter> TIMES = List.of(
            DateTimeFormatter.ofPattern("H:mm", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("H:mm:ss", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("h:mm:ss a", Locale.ENGLISH));

    private final CameraBannerParser bannerParser = new CameraBannerParser();

    /** Step 1: the penalty result page. */
    public Parsed parse(String html) {
        if (html == null || html.isBlank()) {
            return Parsed.of(Outcome.UNRECOGNISED);
        }
        List<String> lines = lines(html);
        boolean looksLikeResult = find(lines, L_DATE) != null && find(lines, L_PENALTY) != null;
        if (!looksLikeResult) {
            return NO_MATCH.matcher(html).find() ? Parsed.of(Outcome.NOT_FOUND) : Parsed.of(Outcome.UNRECOGNISED);
        }
        try {
            BigDecimal penalty = money(require(lines, L_PENALTY));
            BigDecimal owing = money(require(lines, L_OWING));
            String message = statusMessage(lines);
            NoticeStatus status = message.isEmpty()
                    ? (owing.signum() == 0 ? NoticeStatus.PAID : NoticeStatus.OTHER)
                    : status(message);
            NoticeDetails notice = new NoticeDetails(
                    require(lines, L_DESC),
                    date(require(lines, L_DATE)),
                    time(require(lines, L_TIME)),
                    require(lines, L_LOCATION),
                    penalty,
                    owing,
                    status,
                    message,
                    EnforcementMethod.UNKNOWN); // set to CAMERA only once camera images are actually seen
            return new Parsed(Outcome.FOUND, notice, imagesStep(html));
        } catch (IllegalArgumentException | DateTimeParseException e) {
            return Parsed.of(Outcome.UNRECOGNISED);
        }
    }

    /** Step 2: the page returned by "View images". Never throws; an unreadable page gives no media. */
    public ImagesPage parseImages(String html) {
        if (html == null || html.isBlank()) {
            return new ImagesPage(List.of(), null, null);
        }
        List<MediaRef> media = new ArrayList<>();
        String cameraCode = null;
        Matcher item = IMAGE_ITEM.matcher(html);
        while (item.find()) {
            String body = item.group(1);
            Matcher img = IMG_TAG.matcher(body);
            String src = img.find() ? attr(img.group(), "src") : null;
            if (src == null || src.isBlank()) {
                continue;
            }
            String ref = firstRef(attr(item.group(), "data-ref"), body);
            media.add(new MediaRef(EvidenceItem.Kind.IMAGE, ref == null ? "Camera image" : "Camera image " + ref, src));
            Matcher banner = BANNER.matcher(body);
            if (cameraCode == null && banner.find()) {
                cameraCode = bannerParser.parse(String.join("\n", lines(banner.group(1)))).cameraCode();
            }
        }
        return new ImagesPage(media, cameraCode, certificationUrl(html));
    }

    private static String firstRef(String dataRef, String body) {
        if (dataRef != null && REF.matcher(dataRef).matches()) {
            return dataRef;
        }
        Matcher m = REF.matcher(body);
        return m.find() ? m.group() : null;
    }

    private static String certificationUrl(String html) {
        Matcher a = ANCHOR.matcher(html);
        while (a.find()) {
            if (flatten(a.group(2)).toLowerCase(Locale.ROOT).contains("view certification details")) {
                String href = attr(a.group(), "href");
                return href == null || href.isBlank() ? null : href;
            }
        }
        return null;
    }

    /** Finds the "View images" form: its action, the plate input's name, and the hidden inputs to send back. */
    private static ImagesStep imagesStep(String html) {
        Matcher f = FORM.matcher(html);
        while (f.find()) {
            String inner = f.group(2);
            if (!flatten(inner).toLowerCase(Locale.ROOT).contains("view images")
                    && !inner.toLowerCase(Locale.ROOT).contains("value=\"view images\"")) {
                continue;
            }
            String action = attr("<form " + f.group(1) + ">", "action");
            if (action == null || action.isBlank()) {
                return null;
            }
            String plateField = null;
            Map<String, String> fixed = new LinkedHashMap<>();
            Matcher in = INPUT.matcher(inner);
            while (in.find()) {
                String tag = in.group();
                String name = attr(tag, "name");
                String type = nonBlank(attr(tag, "type"), "text").toLowerCase(Locale.ROOT);
                if (name == null || name.isBlank()) {
                    continue;
                }
                String value = nonBlank(attr(tag, "value"), "");
                if (type.equals("hidden")) {
                    fixed.put(name, value);
                } else if (type.equals("submit") && value.equalsIgnoreCase("view images")) {
                    fixed.put(name, value);
                } else if (type.equals("text") && plateField == null) {
                    plateField = name;
                }
            }
            Matcher b = BUTTON.matcher(inner);
            while (b.find()) {
                String name = attr("<button " + b.group(1) + ">", "name");
                if (name != null && !name.isBlank() && flatten(b.group(2)).equalsIgnoreCase("view images")) {
                    fixed.put(name, nonBlank(attr("<button " + b.group(1) + ">", "value"), ""));
                }
            }
            return plateField == null ? null : new ImagesStep(action, plateField, Map.copyOf(fixed));
        }
        return null;
    }

    // ---- label based reading of step 1 -------------------------------------------------------------

    /** Flattens markup to trimmed, non-empty text lines (every tag becomes a line break). */
    static List<String> lines(String html) {
        String t = html.replaceAll("(?is)<(script|style)\\b.*?</\\1>", "\n").replaceAll("(?s)<!--.*?-->", "\n");
        t = unescape(t.replaceAll("<[^>]*>", "\n"));
        List<String> out = new ArrayList<>();
        for (String line : t.split("\\R")) {
            String s = line.replace('\u00a0', ' ').replaceAll("\\s+", " ").trim();
            if (!s.isEmpty()) {
                out.add(s);
            }
        }
        return out;
    }

    private static String flatten(String html) {
        return String.join(" ", lines(html));
    }

    private static boolean isLabel(String line) {
        String l = stripColon(line);
        for (String label : LABELS) {
            if (label.equalsIgnoreCase(l)) {
                return true;
            }
        }
        return false;
    }

    private static String stripColon(String s) {
        String t = s.trim();
        return t.endsWith(":") ? t.substring(0, t.length() - 1).trim() : t;
    }

    /** Value for a label: text after "Label:" on the same line, else the next line (unless that is another label). */
    private static String find(List<String> lines, String label) {
        String prefix = label.toLowerCase(Locale.ROOT) + ":";
        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            String lower = line.toLowerCase(Locale.ROOT);
            if (lower.startsWith(prefix) && line.length() > prefix.length()) {
                return line.substring(prefix.length()).trim();
            }
            if (label.equalsIgnoreCase(stripColon(line))) {
                if (i + 1 < lines.size() && !isLabel(lines.get(i + 1))) {
                    return lines.get(i + 1);
                }
                return null;
            }
        }
        return null;
    }

    private static String require(List<String> lines, String label) {
        String v = find(lines, label);
        if (v == null || v.isBlank()) {
            throw new IllegalArgumentException("missing field " + label);
        }
        return v;
    }

    private static String statusMessage(List<String> lines) {
        for (String line : lines) {
            if (!isLabel(line) && STATUS_LINE.matcher(line).find()) {
                return line;
            }
        }
        return "";
    }

    private static LocalDate date(String text) {
        for (DateTimeFormatter f : DATES) {
            try {
                return LocalDate.parse(text.trim(), f);
            } catch (DateTimeParseException ignored) {
                // try the next format
            }
        }
        throw new IllegalArgumentException("unreadable date");
    }

    private static LocalTime time(String text) {
        String t = text.trim().toUpperCase(Locale.ROOT).replaceAll("\\s*(AM|PM)$", " $1");
        for (DateTimeFormatter f : TIMES) {
            try {
                return LocalTime.parse(t, f);
            } catch (DateTimeParseException ignored) {
                // try the next format
            }
        }
        throw new IllegalArgumentException("unreadable time");
    }

    private static BigDecimal money(String text) {
        String digits = text.replaceAll("[^0-9.]", "");
        if (digits.isEmpty() || digits.equals(".")) {
            throw new IllegalArgumentException("unreadable amount");
        }
        return new BigDecimal(digits);
    }

    private static NoticeStatus status(String text) {
        String t = text.toLowerCase(Locale.ROOT);
        if (t.contains("caution")) return NoticeStatus.CAUTION;
        // payable wording wins: "payable and can be paid online" mentions "paid" but is not paid
        if (t.contains("due") || t.contains("payable") || t.contains("unpaid") || t.contains("overdue")) return NoticeStatus.PAYABLE;
        if (t.contains("paid")) return NoticeStatus.PAID;
        return NoticeStatus.OTHER;
    }

    private static String attr(String tag, String name) {
        Matcher m = Pattern.compile("(?<![\\w-])" + Pattern.quote(name) + "\\s*=\\s*\"([^\"]*)\"", Pattern.CASE_INSENSITIVE).matcher(tag);
        return m.find() ? unescape(m.group(1)).trim() : null;
    }

    private static String nonBlank(String s, String fallback) {
        return s == null || s.isBlank() ? fallback : s;
    }

    private static String unescape(String s) {
        return s.replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"")
                .replace("&#39;", "'").replace("&amp;", "&");
    }
}
