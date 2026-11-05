package cevoc.adapter.out.revenuensw;

import cevoc.domain.EnforcementMethod;
import cevoc.domain.NoticeDetails;
import cevoc.domain.NoticeStatus;
import com.fasterxml.jackson.databind.JsonNode;
import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The only class that knows the JSON field names of the summary call (GET .../fines). A change at the source should break
 * only this class and its fixtures. Pure: no network, no logging.
 *
 * <p>Typed fields fill {@link NoticeDetails}. Everything else the summary returned flows into the flexible details map
 * (record 0009) as string, number or boolean values, except the image identifiers and the certification link, which
 * are handled separately and never copied (the link carries a signed value). The registration number is never in the summary.
 */
public final class RevenueNswSummaryMapper {

    /** What one summary call yields. {@code imageIds} holds only identifiers that are safe to put in a path. */
    public record Summary(String noticeNumber, NoticeDetails notice, Map<String, Object> details, List<String> imageIds,
                          int imageCount, String cameraCode) {}

    static final Pattern SAFE_ID = Pattern.compile("[A-Za-z0-9._~-]{1,100}");
    private static final Pattern CAMERA_CODE = Pattern.compile("[A-Za-z0-9]{1,12}");
    private static final int MAX_IMAGES = 20;
    private static final int MAX_DETAILS = 40;
    private static final int MAX_TEXT = 300;
    private static final int MAX_DEPTH = 4;
    /** Paths handled elsewhere or never copied. */
    private static final Set<String> SKIP = Set.of("pnNum", "timestamp", "offence.desc", "offence.date", "offence.time", "offence.amount",
            "offence.location", "offence.demerit.points", "payment.outstanding.amount", "images.identifiers", "images.cameraCertification.ref",
            "images.count", "notifications");

    private RevenueNswSummaryMapper() {}

    public static Summary map(JsonNode root) {
        JsonNode offence = root.path("offence");
        JsonNode images = root.path("images");
        String number = text(root.path("pnNum"));

        List<String> ids = new ArrayList<>();
        for (JsonNode id : images.path("identifiers")) {
            String v = id.isTextual() || id.isNumber() ? id.asText() : null;
            if (v != null && SAFE_ID.matcher(v).matches() && ids.size() < MAX_IMAGES) {
                ids.add(v);
            }
        }
        int count = images.path("count").isNumber() ? images.path("count").asInt() : ids.size();

        BigDecimal penalty = decimal(offence.path("amount"));
        BigDecimal owing = decimal(root.path("payment").path("outstanding").path("amount"));
        String message = firstNotification(root.path("notifications"));
        NoticeStatus status = status(message, owing);
        EnforcementMethod method = count > 0 || !ids.isEmpty() ? EnforcementMethod.CAMERA : EnforcementMethod.UNKNOWN;
        NoticeDetails notice = new NoticeDetails(clean(text(offence.path("desc"))), date(text(offence.path("date"))),
                time(text(offence.path("time"))), location(offence.path("location")), penalty, owing, status,
                message, method);

        Map<String, Object> details = new LinkedHashMap<>();
        if (offence.path("demerit").path("points").isNumber()) {
            details.put("demeritPoints", offence.path("demerit").path("points").numberValue());
        }
        details.put("imageCount", count);
        flatten(root, "", 0, details);
        return new Summary(number, notice, details, List.copyOf(ids), count, cameraCode(images.path("cameraCertification").path("ref")));
    }

    /** First notification message text, trimmed and capped, or null. */
    static String firstNotification(JsonNode notifications) {
        for (JsonNode n : notifications) {
            String t = clean(text(n.path("message").path("text")));
            if (t != null) {
                return t;
            }
        }
        return null;
    }

    static NoticeStatus status(String message, BigDecimal owing) {
        String t = message == null ? "" : message.toLowerCase(Locale.ROOT);
        if (t.contains("caution")) {
            return NoticeStatus.CAUTION;
        }
        if (owing != null) {
            return owing.signum() == 0 ? NoticeStatus.PAID : NoticeStatus.PAYABLE;
        }
        return t.contains("paid") ? NoticeStatus.PAID : NoticeStatus.OTHER;
    }

    /** Only the {@code s} query value of the certification link (the camera code the certificates page is keyed by). The signed value is never read. */
    static String cameraCode(JsonNode ref) {
        String r = text(ref);
        if (r == null) {
            return null;
        }
        try {
            String q = URI.create(r).getRawQuery();
            if (q == null) {
                return null;
            }
            for (String pair : q.split("&")) {
                if (pair.startsWith("s=")) {
                    String v = pair.substring(2);
                    return CAMERA_CODE.matcher(v).matches() ? v : null;
                }
            }
        } catch (IllegalArgumentException e) {
            return null;
        }
        return null;
    }

    private static void flatten(JsonNode node, String path, int depth, Map<String, Object> out) {
        if (node.isObject()) {
            node.fields().forEachRemaining(e -> {
                String child = path.isEmpty() ? e.getKey() : path + "." + e.getKey();
                if (SKIP.contains(child) || out.size() >= MAX_DETAILS) {
                    return;
                }
                JsonNode v = e.getValue();
                if (v.isObject() && depth < MAX_DEPTH) {
                    flatten(v, child, depth + 1, out);
                } else if (v.isArray()) {
                    put(out, child + ".count", v.size());
                } else if (v.isNumber()) {
                    put(out, child, v.numberValue());
                } else if (v.isBoolean()) {
                    put(out, child, v.booleanValue());
                } else if (v.isTextual()) {
                    String t = clean(v.asText());
                    if (t != null) {
                        put(out, child, t);
                    }
                }
            });
        }
    }

    private static void put(Map<String, Object> out, String path, Object value) {
        String key = key(path);
        if (!key.isEmpty() && !out.containsKey(key) && out.size() < MAX_DETAILS) {
            out.put(key, value);
        }
    }

    /** "payment.outstanding.currency" to paymentOutstandingCurrency: lower camel case, letters and digits only. */
    static String key(String path) {
        StringBuilder sb = new StringBuilder();
        boolean upper = false;
        for (char c : path.toCharArray()) {
            if (Character.isLetterOrDigit(c) && c < 128) {
                sb.append(sb.length() == 0 ? Character.toLowerCase(c) : upper ? Character.toUpperCase(c) : c);
                upper = false;
            } else {
                upper = sb.length() > 0;
            }
        }
        return sb.length() > 60 ? sb.substring(0, 60) : sb.toString();
    }

    private static String location(JsonNode loc) {
        String street = clean(text(loc.path("street")));
        String suburb = clean(text(loc.path("suburb")));
        if (street == null) {
            return suburb;
        }
        return suburb == null ? street : street + ", " + suburb;
    }

    static LocalDate date(String s) {
        if (s == null) {
            return null;
        }
        String v = s.trim();
        try {
            if (v.length() >= 10 && v.charAt(4) == '-') {
                return LocalDate.parse(v.substring(0, 10));
            }
            if (v.length() >= 10 && v.charAt(2) == '/') {
                return LocalDate.parse(v.substring(0, 10), DateTimeFormatter.ofPattern("dd/MM/uuuu", Locale.ENGLISH));
            }
        } catch (DateTimeParseException e) {
            return null;
        }
        return null;
    }

    static LocalTime time(String s) {
        if (s == null) {
            return null;
        }
        String v = s.trim();
        if (v.length() > 8 && v.contains("T")) {
            v = v.substring(v.indexOf('T') + 1);
        }
        if (v.length() > 8 && v.charAt(2) == ':' && v.charAt(5) == ':') {
            v = v.substring(0, 8);
        }
        for (String f : new String[] {"HH:mm:ss", "HH:mm", "H:mm", "HHmm"}) {
            try {
                return LocalTime.parse(v, DateTimeFormatter.ofPattern(f, Locale.ENGLISH));
            } catch (DateTimeParseException ignored) {
                // try the next shape
            }
        }
        return null;
    }

    private static BigDecimal decimal(JsonNode n) {
        return n.isNumber() ? n.decimalValue() : null;
    }

    private static String text(JsonNode n) {
        return n == null || n.isMissingNode() || n.isNull() || !(n.isTextual() || n.isNumber()) ? null : n.asText();
    }

    /** Trimmed, control characters removed, length-capped; null when empty. */
    static String clean(String s) {
        if (s == null) {
            return null;
        }
        String t = s.replaceAll("\\p{Cntrl}", " ").trim();
        if (t.isEmpty()) {
            return null;
        }
        return t.length() > MAX_TEXT ? t.substring(0, MAX_TEXT) : t;
    }
}
