package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
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
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

/**
 * The ONLY class that knows what the rendered myPenalty DOM looks like. It reads the three states of the flow
 * and decides which one it is looking at from what is PRESENT, never from page order:
 * <ol>
 *   <li>LOGIN: inputs pnn (penalty notice number) and dateOfOffence, a Next button. Hidden, disabled lastName,
 *       firstName and organisation inputs exist for some notice types; if one of them is NOT disabled the
 *       notice type needs details we do not collect ({@link Page#unexpectedLoginFields()}).</li>
 *   <li>SUMMARY: heading "Penalty Notice Number - n", a notification box (paid or owing), rows labelled
 *       "Date of offence:", "Offence Time:", "Offence Description:", "Demerit Points:", "Penalty Amount:",
 *       "Location:" (free text, not a code), and a SEPARATE images form with one input, vehicleNumber
 *       ("Registration number:"), and a "View images" button. No "Registration number:" row yet.</li>
 *   <li>IMAGES: the plate form is gone, a "Registration number:" row has appeared in the details, a large image
 *       and thumbnails each carry a ref like 700-1-123456789, a "Download Images" button, and a Camera
 *       Certification section with a "View certification details" link to certificateDetails.jsf.</li>
 * </ol>
 * The markup is inferred from the owner's description (no real page source has been seen), so the fixtures are
 * FICTITIOUS and the selectors are best guesses. Rows are found by their visible labels.
 *
 * Privacy rules enforced here:
 * <ul>
 *   <li>The registration is never read. We only note whether a "Registration number:" row is present.</li>
 *   <li>The certificate link's signed value (query parameter m) is never kept: {@link CertificationRef} has no
 *       field for it, and nothing here builds a certificate URL.</li>
 *   <li>Image src values are blob: URLs tied to the browser session; they are handles for
 *       {@link RenderedPageSession#imageBytes}, not fetchable URLs.</li>
 * </ul>
 */
public class RevenueNswPageParser {

    public enum State { LOGIN, SUMMARY, IMAGES, UNRECOGNISED }

    /** One distinct evidence image: its ref (700-1-...) and the session-bound blob: handle. */
    public record ImageRef(String ref, String blobUrl) {}

    /**
     * The parts of the certificateDetails.jsf link we may use: p notice, d offence date-time (as written),
     * s camera code, i incident number. The signed value m is deliberately absent.
     */
    public record CertificationRef(String notice, String offenceDateTime, String cameraCode, String incidentNumber) {}

    /**
     * What one rendered page shows. Fields that do not apply to the state are null, false or empty.
     * {@code cameraCode} is the banner's camera code, else the certificate link's s value.
     */
    public record Page(
            State state,
            String noticeNumber,
            NoticeDetails notice,
            boolean plateFormPresent,
            boolean registrationRequiredShown,
            boolean registrationRowPresent,
            List<String> unexpectedLoginFields,
            List<ImageRef> images,
            boolean downloadImagesPresent,
            String cameraCode,
            CertificationRef certification) {

        static Page unrecognised() {
            return new Page(State.UNRECOGNISED, null, null, false, false, false, List.of(), List.of(), false, null, null);
        }
    }

    static final String PLATE_INPUT = "vehicleNumber";
    private static final List<String> OPTIONAL_LOGIN_FIELDS = List.of("lastName", "firstName", "organisation");

    private static final String L_DATE = "Date of offence";
    private static final String L_TIME = "Offence Time";
    private static final String L_DESC = "Offence Description";
    private static final String L_PENALTY = "Penalty Amount";
    private static final String L_LOCATION = "Location";
    private static final String L_REGISTRATION = "Registration number";

    private static final Pattern HEADING = Pattern.compile("Penalty Notice Number\\s*[-–:]\\s*([A-Za-z0-9]{4,20})");
    private static final Pattern REF = Pattern.compile("(?<![\\d-])\\d{1,4}-\\d{1,3}-\\d{4,12}(?![\\d-])");
    private static final Pattern BANNER_CODE = Pattern.compile("Camera Code\\s*:\\s*([A-Za-z0-9-]{1,20})", Pattern.CASE_INSENSITIVE);
    private static final Pattern MONEY_IN_TEXT = Pattern.compile("\\$\\s?([0-9][0-9,]*(?:\\.[0-9]{2})?)");
    private static final Pattern STATUS_LINE = Pattern.compile(
            "(?i)\\b(has been paid|is paid|paid in full|payable|payment (is )?due|overdue|owing|caution|no payment)\\b");

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

    /** Reads whichever state the rendered DOM is in. Never throws; anything unreadable is UNRECOGNISED. */
    public Page parse(String html) {
        if (html == null || html.isBlank()) {
            return Page.unrecognised();
        }
        try {
            return read(Jsoup.parse(html));
        } catch (RuntimeException e) {
            return Page.unrecognised();
        }
    }

    private Page read(Document doc) {
        boolean loginForm = doc.selectFirst("input[name=pnn]") != null && doc.selectFirst("input[name=dateOfOffence]") != null;
        boolean plateForm = doc.selectFirst("input[name=" + PLATE_INPUT + "]") != null;
        String heading = heading(doc);
        boolean detailsPresent = value(doc, L_DATE) != null || value(doc, L_PENALTY) != null || heading != null;

        if (!detailsPresent) {
            if (loginForm) {
                return new Page(State.LOGIN, null, null, false, false, false, unexpectedLoginFields(doc),
                        List.of(), false, null, null);
            }
            return Page.unrecognised();
        }

        NoticeDetails notice = notice(doc);
        if (notice == null) {
            return Page.unrecognised();
        }
        List<ImageRef> images = plateForm ? List.of() : images(doc);
        boolean registrationRow = registrationRowPresent(doc);
        boolean imagesState = !plateForm && (!images.isEmpty() || registrationRow);
        boolean required = doc.text().toLowerCase(Locale.ROOT).contains("registration number is required");
        if (!imagesState) {
            return new Page(State.SUMMARY, heading, notice, plateForm, required, false, List.of(), List.of(), false, null, null);
        }
        CertificationRef cert = certification(doc);
        String code = bannerCameraCode(doc);
        if (code == null && cert != null) {
            code = cert.cameraCode();
        }
        boolean download = hasControl(doc, "download images");
        NoticeDetails camera = new NoticeDetails(notice.offenceDescription(), notice.offenceDate(), notice.offenceTime(),
                notice.location(), notice.penaltyAmount(), notice.amountOwing(), notice.noticeStatus(), notice.statusMessage(),
                images.isEmpty() ? notice.enforcementMethod() : EnforcementMethod.CAMERA);
        return new Page(State.IMAGES, heading, camera, false, false, registrationRow, List.of(), images, download, code, cert);
    }

    // ---- state 1 -------------------------------------------------------------------------------------

    private static List<String> unexpectedLoginFields(Document doc) {
        List<String> out = new ArrayList<>();
        for (String name : OPTIONAL_LOGIN_FIELDS) {
            Element input = doc.selectFirst("input[name=" + name + "]");
            if (input != null && !input.hasAttr("disabled")) {
                out.add(name);
            }
        }
        return List.copyOf(out);
    }

    // ---- state 2 -------------------------------------------------------------------------------------

    private static String heading(Document doc) {
        Matcher m = HEADING.matcher(doc.text());
        return m.find() ? m.group(1) : null;
    }

    private static NoticeDetails notice(Document doc) {
        try {
            BigDecimal penalty = money(require(doc, L_PENALTY));
            String message = statusMessage(doc);
            NoticeStatus status = message.isEmpty() ? NoticeStatus.OTHER : status(message);
            BigDecimal owing = owing(message, status, penalty);
            return new NoticeDetails(
                    require(doc, L_DESC),
                    date(require(doc, L_DATE)),
                    time(require(doc, L_TIME)),
                    require(doc, L_LOCATION),
                    penalty,
                    owing,
                    status,
                    message,
                    EnforcementMethod.UNKNOWN); // CAMERA only once camera images are actually seen
        } catch (IllegalArgumentException | DateTimeParseException e) {
            return null;
        }
    }

    /**
     * Paid means nothing owing. Otherwise an amount written in the notification box, else the penalty amount
     * (ASSUMPTION: the box wording is unknown, so an unpaid notice is taken to owe the full penalty).
     */
    private static BigDecimal owing(String message, NoticeStatus status, BigDecimal penalty) {
        if (status == NoticeStatus.PAID) {
            return BigDecimal.ZERO;
        }
        Matcher m = MONEY_IN_TEXT.matcher(message);
        return m.find() ? new BigDecimal(m.group(1).replace(",", "")) : penalty;
    }

    private static String statusMessage(Document doc) {
        for (Element box : doc.select("[role=alert], .alert, .notification, .notice, .message")) {
            String t = clean(box.text());
            if (!t.isEmpty() && STATUS_LINE.matcher(t).find()) {
                return t;
            }
        }
        for (Element el : doc.select("p, div, span, li")) {
            if (el.children().stream().anyMatch(c -> c.tagName().equals("p") || c.tagName().equals("div"))) {
                continue; // leaf-ish elements only
            }
            if (insideBanner(el) || insideForm(el)) {
                continue;
            }
            String t = clean(el.text());
            if (t.length() <= 300 && !t.contains(":") && STATUS_LINE.matcher(t).find()) {
                return t;
            }
        }
        return "";
    }

    // ---- labelled rows ---------------------------------------------------------------------------------

    private static String require(Document doc, String label) {
        String v = value(doc, label);
        if (v == null || v.isBlank()) {
            throw new IllegalArgumentException("missing field " + label);
        }
        return v;
    }

    /**
     * Value of a labelled row: text after "Label:" in the same element, else the next sibling element's text.
     * Ignores banner text and the plate form, so the free-text Location row cannot be confused with the
     * banner's "Location:".
     */
    private static String value(Document doc, String label) {
        String key = label.toLowerCase(Locale.ROOT);
        for (Element el : doc.getAllElements()) {
            if (insideBanner(el) || insideForm(el)) {
                continue;
            }
            String own = clean(el.ownText());
            String lower = own.toLowerCase(Locale.ROOT);
            if (lower.equals(key) || lower.equals(key + ":")) {
                Element next = el.nextElementSibling();
                if (next != null) {
                    String v = clean(next.text());
                    return v.isEmpty() ? null : v;
                }
                Element parent = el.parent();
                if (parent != null) {
                    String all = clean(parent.text());
                    String rest = all.length() > own.length() && all.toLowerCase(Locale.ROOT).startsWith(lower)
                            ? all.substring(own.length()).trim() : "";
                    return rest.isEmpty() ? null : rest;
                }
            } else if (lower.startsWith(key + ":") && own.length() > key.length() + 1) {
                return own.substring(key.length() + 1).trim();
            }
        }
        return null;
    }

    /** True when a "Registration number:" label exists outside the plate form. The value is never read. */
    private static boolean registrationRowPresent(Document doc) {
        String key = L_REGISTRATION.toLowerCase(Locale.ROOT);
        for (Element el : doc.getAllElements()) {
            if (insideBanner(el) || insideForm(el)) {
                continue;
            }
            String lower = clean(el.ownText()).toLowerCase(Locale.ROOT);
            if (lower.equals(key) || lower.startsWith(key + ":")) {
                return true;
            }
        }
        return false;
    }

    private static boolean insideBanner(Element el) {
        return el.closest("figcaption, .banner") != null;
    }

    /** Inside the images (plate) form, or the login form. */
    private static boolean insideForm(Element el) {
        Element form = el.closest("form");
        return form != null && (form.selectFirst("input[name=" + PLATE_INPUT + "]") != null
                || form.selectFirst("input[name=pnn]") != null);
    }

    // ---- state 3 -------------------------------------------------------------------------------------

    private static List<ImageRef> images(Document doc) {
        Map<String, ImageRef> byRef = new LinkedHashMap<>();
        for (Element img : doc.select("img")) {
            String src = img.attr("src").trim();
            if (src.isEmpty()) {
                continue;
            }
            String ref = refFor(img);
            if (ref != null) {
                byRef.putIfAbsent(ref, new ImageRef(ref, src));
            }
        }
        return List.copyOf(byRef.values());
    }

    /** The ref from the img's own attributes, else from a nearby container whose text holds exactly one ref. */
    private static String refFor(Element img) {
        for (String attr : new String[] {"data-ref", "alt", "title", "aria-label"}) {
            Matcher m = REF.matcher(img.attr(attr));
            if (m.find()) {
                return m.group();
            }
        }
        Element up = img.parent();
        for (int depth = 0; up != null && depth < 3; depth++, up = up.parent()) {
            Matcher m = REF.matcher(up.text());
            String first = null;
            boolean many = false;
            while (m.find()) {
                if (first == null) {
                    first = m.group();
                } else if (!first.equals(m.group())) {
                    many = true;
                }
            }
            if (first != null && !many) {
                return first;
            }
            if (many) {
                return null;
            }
        }
        return null;
    }

    private static boolean hasControl(Document doc, String text) {
        for (Element el : doc.select("button, a, input[type=button], input[type=submit]")) {
            String t = el.tagName().equals("input") ? el.attr("value") : el.text();
            if (clean(t).equalsIgnoreCase(text)) {
                return true;
            }
        }
        return false;
    }

    /** Camera code from banner text: banner elements first, else a "Camera Code:" anywhere in the page text. */
    private String bannerCameraCode(Document doc) {
        for (Element banner : doc.select("figcaption, .banner")) {
            String code = bannerParser.parse(banner.wholeText()).cameraCode();
            if (code == null) {
                code = bannerParser.parse(banner.text()).cameraCode();
            }
            if (code != null) {
                return code;
            }
        }
        Matcher m = BANNER_CODE.matcher(doc.text());
        return m.find() ? m.group(1) : null;
    }

    /** Reads p, d, s and i from the certificate link. The signed m value is skipped and never kept. */
    private static CertificationRef certification(Document doc) {
        for (Element a : doc.select("a[href]")) {
            if (!clean(a.text()).toLowerCase(Locale.ROOT).contains("view certification details")) {
                continue;
            }
            String href = a.attr("href");
            int q = href.indexOf('?');
            String path = (q < 0 ? href : href.substring(0, q)).toLowerCase(Locale.ROOT);
            if (!path.contains("certificatedetails.jsf")) {
                return null;
            }
            Map<String, String> wanted = new LinkedHashMap<>();
            if (q >= 0) {
                String query = href.substring(q + 1);
                int hash = query.indexOf('#');
                for (String pair : (hash < 0 ? query : query.substring(0, hash)).split("&")) {
                    int eq = pair.indexOf('=');
                    String k = eq < 0 ? pair : pair.substring(0, eq);
                    if (k.equals("p") || k.equals("d") || k.equals("s") || k.equals("i")) {
                        wanted.putIfAbsent(k, eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8));
                    }
                }
            }
            return new CertificationRef(blankToNull(wanted.get("p")), blankToNull(wanted.get("d")),
                    blankToNull(wanted.get("s")), blankToNull(wanted.get("i")));
        }
        return null;
    }

    // ---- value parsing -------------------------------------------------------------------------------

    private static String clean(String s) {
        return s == null ? "" : s.replace(' ', ' ').replaceAll("\\s+", " ").trim();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
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
        // owing/payable wording wins: "payable and can be paid online" mentions "paid" but is not paid
        if (t.contains("due") || t.contains("payable") || t.contains("unpaid") || t.contains("overdue") || t.contains("owing")) {
            return NoticeStatus.PAYABLE;
        }
        if (t.contains("paid")) return NoticeStatus.PAID;
        return NoticeStatus.OTHER;
    }
}
