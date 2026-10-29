package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * The ONLY class that knows what the penalty page's HTML looks like. If the site changes, only this
 * class (and its fixture) should need to change.
 *
 * IMPORTANT: the real page structure is UNKNOWN. This parser targets the FICTITIOUS markup in
 * src/test/resources/fixtures/scraper/fictitious-notice-page.html. It will not work against the real
 * site until a person supplies a screenshot or page source and the TODO list in docs/ARCHITECTURE.md
 * is worked through.
 *
 * TODO (needs the real page): selectors for each field; how "not found" is shown; how a notice with no
 * evidence is shown; whether media sits behind a separate request or login; date/time/amount formats;
 * lazy-loaded media (data-src, JS-injected); video as file versus streamed (HLS/DASH) which this cannot buffer.
 * It uses regular expressions on purpose (no extra dependency); swap in an HTML parser once the real
 * markup is known.
 */
public class RevenueNswPageParser {

    public enum Outcome { FOUND, NOT_FOUND, UNRECOGNISED }

    /** A media reference exactly as written in the page (src may be relative). */
    public record MediaRef(EvidenceItem.Kind kind, String title, String src) {}

    public record Parsed(Outcome outcome, NoticeDetails notice, List<MediaRef> media) {
        static Parsed of(Outcome o) {
            return new Parsed(o, null, List.of());
        }
    }

    private static final Pattern NO_MATCH = Pattern.compile("id=\"no-match\"");
    private static final Pattern RESULT = Pattern.compile("id=\"notice-result\"");
    private static final Pattern IMG = Pattern.compile("<img\\b[^>]*\\bclass=\"[^\"]*\\bevidence-image\\b[^\"]*\"[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern VIDEO = Pattern.compile("<video\\b[^>]*\\bclass=\"[^\"]*\\bevidence-video\\b[^\"]*\"[^>]*>(.*?)</video>",
            Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
    private static final Pattern SOURCE_TAG = Pattern.compile("<source\\b[^>]*>", Pattern.CASE_INSENSITIVE);

    public Parsed parse(String html) {
        if (html == null || html.isBlank()) {
            return Parsed.of(Outcome.UNRECOGNISED);
        }
        if (NO_MATCH.matcher(html).find()) {
            return Parsed.of(Outcome.NOT_FOUND);
        }
        if (!RESULT.matcher(html).find()) {
            return Parsed.of(Outcome.UNRECOGNISED);
        }
        try {
            List<MediaRef> media = media(html);
            NoticeDetails notice = new NoticeDetails(
                    required(html, "offence"),
                    LocalDate.parse(required(html, "offence-date")),
                    LocalTime.parse(required(html, "offence-time")),
                    required(html, "location"),
                    money(required(html, "penalty-amount")),
                    money(required(html, "amount-owing")),
                    status(required(html, "status")),
                    required(html, "status-message"),
                    media.isEmpty() ? EnforcementMethod.UNKNOWN : EnforcementMethod.CAMERA);
            return new Parsed(Outcome.FOUND, notice, media);
        } catch (IllegalArgumentException | DateTimeParseException e) {
            return Parsed.of(Outcome.UNRECOGNISED);
        }
    }

    private static List<MediaRef> media(String html) {
        List<MediaRef> out = new ArrayList<>();
        Matcher img = IMG.matcher(html);
        while (img.find()) {
            String src = attr(img.group(), "src");
            if (src != null && !src.isBlank()) {
                out.add(new MediaRef(EvidenceItem.Kind.IMAGE, nonBlank(attr(img.group(), "alt"), "Evidence image"), src));
            }
        }
        Matcher video = VIDEO.matcher(html);
        while (video.find()) {
            String src = attr(video.group(), "src");
            if (src == null) {
                Matcher s = SOURCE_TAG.matcher(video.group(1));
                if (s.find()) {
                    src = attr(s.group(), "src");
                }
            }
            if (src != null && !src.isBlank()) {
                out.add(new MediaRef(EvidenceItem.Kind.VIDEO, nonBlank(attr(video.group(), "title"), "Evidence video"), src));
            }
        }
        return out;
    }

    private static String required(String html, String field) {
        Matcher m = Pattern.compile("data-field=\"" + Pattern.quote(field) + "\"[^>]*>(.*?)</", Pattern.DOTALL).matcher(html);
        if (!m.find()) {
            throw new IllegalArgumentException("missing field " + field);
        }
        String text = unescape(m.group(1).replaceAll("<[^>]*>", "")).trim();
        if (text.isEmpty()) {
            throw new IllegalArgumentException("empty field " + field);
        }
        return text;
    }

    private static String attr(String tag, String name) {
        Matcher m = Pattern.compile("(?<![\\w-])" + Pattern.quote(name) + "\\s*=\\s*\"([^\"]*)\"", Pattern.CASE_INSENSITIVE).matcher(tag);
        return m.find() ? unescape(m.group(1)).trim() : null;
    }

    private static BigDecimal money(String text) {
        return new BigDecimal(text.replaceAll("[^0-9.]", ""));
    }

    private static NoticeStatus status(String text) {
        String t = text.toLowerCase(Locale.ROOT);
        if (t.contains("caution")) return NoticeStatus.CAUTION;
        if (t.contains("paid") && !t.contains("unpaid")) return NoticeStatus.PAID;
        if (t.contains("due") || t.contains("payable") || t.contains("unpaid")) return NoticeStatus.PAYABLE;
        return NoticeStatus.OTHER;
    }

    private static String nonBlank(String s, String fallback) {
        return s == null || s.isBlank() ? fallback : s;
    }

    private static String unescape(String s) {
        return s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").replace("&amp;", "&");
    }
}
