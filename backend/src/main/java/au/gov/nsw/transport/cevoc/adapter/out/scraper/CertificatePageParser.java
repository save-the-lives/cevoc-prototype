package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.time.DateTimeException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;

/**
 * The ONLY class that knows the JSF page's HTML. Everything else works with the small records below.
 *
 * <p>Known from the owner's screenshot of the real page ("Customer Enquiry and Verification of Certificate"):
 * mandatory fields "Location code" (short text), "Date/Time from" and "Date/Time to" (both dd/MM/yyyy HH:mm
 * with a calendar picker; "to" is pre-filled with the current date/time); buttons SEARCH, CLEAR, CLOSE.
 *
 * <p>Results table (known): columns Certificate Description, Certificate type, Period, Certified date, Expiry date,
 * matched by header text. There is no visible download link; the deep link certificateDetails.jsf carries a signed
 * "m" parameter, so links are never constructed, only hrefs present in the row are copied.
 *
 * <p>TODO (owner to supply the saved page source or the results screenshot; a person saves it, with approval):
 * <ol>
 *   <li>The REAL JSF ids/names: form id, location code input, date from, date to, SEARCH button. The constants below
 *       are GUESSES that only match the fictitious fixtures. Real ids come from the page source.</li>
 *   <li>The exact "no results" message and the exact Period text format (tolerantly parsed meanwhile).</li>
 *   <li>Whether a captcha or login step exists (if so, stop: do not automate).</li>
 * </ol>
 */
public class CertificatePageParser {

    // ---- TODO: replace with real ids from the real page source (all guesses) ----
    static final String FORM_ID = "searchForm";
    static final String FORM_SELECTOR = "form#searchForm";
    static final String LOCATION_CODE_INPUT = "searchForm:locationCode";   // label "Location code"
    static final String DATE_FROM_INPUT = "searchForm:dateTimeFrom";       // label "Date/Time from"
    static final String DATE_TO_INPUT = "searchForm:dateTimeTo";           // label "Date/Time to"
    static final String SEARCH_BUTTON = "searchForm:searchButton";         // button "SEARCH"
    /** Legacy BY_PENALTY only: the real page has no penalty number field. */
    static final String PENALTY_INPUT = "searchForm:penaltyNumber";
    /** "No results" marker: a guess (plus the PrimeFaces empty-message class). Absence of both a table and this throws. */
    static final String NO_RESULTS_SELECTOR = ".no-results, .ui-datatable-empty-message";
    // ----------------------------------------------------------------------------
    /** Format shown on the real page's date/time fields (known). */
    static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    /** Result dates: dd/MM/yyyy with an optional HH:mm[:ss]. Tolerant because the exact result format is not confirmed. */
    private static final Pattern DATE_TIME =
            Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{4})(?:\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?");

    /** What a POST needs: where to submit and the hidden fields (including javax.faces.ViewState). */
    public record FormState(String actionUrl, String viewState, Map<String, String> hiddenFields) {}

    /** Reads the form action and all hidden inputs, requiring a ViewState. */
    public FormState parseForm(String html, String pageUrl) {
        Document doc = Jsoup.parse(html, pageUrl);
        Element form = doc.selectFirst(FORM_SELECTOR);
        if (form == null) throw new ScrapeException("Search form not found: page structure changed or TODO selectors not set");
        Map<String, String> hidden = new LinkedHashMap<>();
        for (Element in : form.select("input[type=hidden]")) {
            if (!in.attr("name").isEmpty()) hidden.put(in.attr("name"), in.attr("value"));
        }
        String viewState = hidden.get("javax.faces.ViewState");
        if (viewState == null) viewState = hidden.get("jakarta.faces.ViewState");
        if (viewState == null || viewState.isBlank()) throw new ScrapeException("ViewState not found");
        String action = form.absUrl("action");
        return new FormState(action.isEmpty() ? pageUrl : action, viewState, hidden);
    }

    /** POST body for the real search: hidden fields (fresh ViewState) plus location code, from, to and the button. */
    public Map<String, String> buildSearchPost(FormState state, String locationCode, LocalDateTime from, LocalDateTime to) {
        if (locationCode == null || locationCode.isBlank()) throw new IllegalArgumentException("locationCode is mandatory");
        if (from == null || to == null) throw new IllegalArgumentException("Date/Time from and to are mandatory");
        Map<String, String> post = new LinkedHashMap<>(state.hiddenFields());
        post.put(FORM_ID, FORM_ID);
        post.put(LOCATION_CODE_INPUT, locationCode);
        post.put(DATE_FROM_INPUT, DATE_TIME_FORMAT.format(from));
        post.put(DATE_TO_INPUT, DATE_TIME_FORMAT.format(to));
        post.put(SEARCH_BUTTON, "");
        return post;
    }

    /** Legacy BY_PENALTY post body. The real page does not support this. */
    public Map<String, String> buildPenaltySearchPost(FormState state, String penaltyNumber) {
        Map<String, String> post = new LinkedHashMap<>(state.hiddenFields());
        post.put(FORM_ID, FORM_ID);
        post.put(PENALTY_INPUT, penaltyNumber);
        post.put(SEARCH_BUTTON, "");
        return post;
    }

    public boolean hasNoResults(String html) {
        return Jsoup.parse(html).selectFirst(NO_RESULTS_SELECTOR) != null;
    }

    /**
     * Parses the results table. Columns are found by header text (Certificate Description, Certificate type,
     * Period, Certified date, Expiry date), not position. Returns an empty list for a "no results" page and throws
     * ScrapeException when neither a results table nor a no-results marker is present (layout changed).
     */
    public List<CertificateRef> parseCertificates(String html) {
        Document doc = Jsoup.parse(html);
        if (doc.selectFirst(NO_RESULTS_SELECTOR) != null) return List.of();
        for (Element table : doc.select("table")) {
            Element headerRow = table.select("tr").stream().filter(r -> !r.select("th").isEmpty()).findFirst().orElse(null);
            if (headerRow == null) continue;
            Map<String, Integer> cols = columns(headerRow.select("th"));
            if (!cols.containsKey("description") || !cols.containsKey("period")) continue;
            if (table.select("tr").stream().noneMatch(r -> !r.select("td").isEmpty())) {
                // Scrollable data tables keep the header in one table and the rows in another: take the first body
                // table after it that has rows with at least as many cells as the header has columns.
                Element body = bodyTableAfter(doc, table, headerRow.select("th").size());
                if (body == null) return List.of();
                return rows(body, cols);
            }
            return rows(table, cols);
        }
        throw new ScrapeException("Results table not found: page structure changed");
    }

    private static Element bodyTableAfter(Document doc, Element headerTable, int columns) {
        boolean after = false;
        for (Element t : doc.select("table")) {
            if (t == headerTable) {
                after = true;
                continue;
            }
            if (after && t.select("tr").stream().anyMatch(r -> r.children().stream().filter(c -> c.normalName().equals("td")).count() >= columns)) {
                return t;
            }
        }
        return null;
    }

    private List<CertificateRef> rows(Element table, Map<String, Integer> cols) {
        List<CertificateRef> out = new ArrayList<>();
        for (Element row : table.select("tr")) {
            Elements cells = new Elements(row.children().stream().filter(c -> c.normalName().equals("td")).toList());
            if (cells.isEmpty() || cells.stream().anyMatch(c -> c.hasAttr("colspan"))) continue; // header/empty-message rows
            String period = cell(cells, cols.get("period"));
            LocalDateTime[] window = period(period);
            out.add(new CertificateRef(
                    nullIfEmpty(cell(cells, cols.get("description"))),
                    nullIfEmpty(cell(cells, cols.get("type"))),
                    nullIfEmpty(period),
                    window[0], window[1],
                    dateTime(cell(cells, cols.get("certified")), false),
                    dateTime(cell(cells, cols.get("expiry")), false),
                    href(row)));
        }
        return out;
    }

    private static Map<String, Integer> columns(Elements headers) {
        Map<String, Integer> cols = new HashMap<>();
        for (int i = 0; i < headers.size(); i++) {
            String k = key(headers.get(i).text());
            if (k != null) cols.putIfAbsent(k, i);
        }
        return cols;
    }

    /** Which of the five known columns a header or label text names, or null. */
    static String key(String text) {
        String h = text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
        if (h.contains("description")) return "description";
        if (h.contains("type")) return "type";
        if (h.contains("period")) return "period";
        if (h.contains("certified")) return "certified";
        if (h.contains("expiry")) return "expiry";
        return null;
    }

    /**
     * Reads the RENDERED certificates page reached through the browser route (the certification link of the evidence
     * page). Accepts a results table (as {@link #parseCertificates}) or, failing that, a label/value layout
     * (label cells, dt/dd or label elements naming the five known fields). An explicit no-results marker gives an
     * empty list; a page with neither layout throws ScrapeException.
     */
    public List<CertificateRef> parseRendered(String html) {
        Document doc = Jsoup.parse(html);
        if (doc.selectFirst(NO_RESULTS_SELECTOR) != null) return List.of();
        try {
            return parseCertificates(html);
        } catch (ScrapeException noTable) {
            List<CertificateRef> labelled = parseLabelled(doc);
            if (labelled.isEmpty()) throw noTable;
            return labelled;
        }
    }

    private static List<CertificateRef> parseLabelled(Document doc) {
        List<CertificateRef> out = new ArrayList<>();
        Map<String, String> cur = new LinkedHashMap<>();
        for (Element e : doc.select("tr, dt, label")) {
            List<String[]> pairs = new ArrayList<>();
            if (e.normalName().equals("tr")) {
                Elements cells = new Elements(e.children().stream().filter(c -> c.normalName().equals("td") || c.normalName().equals("th")).toList());
                for (int i = 0; i + 1 < cells.size(); i += 2) {
                    pairs.add(new String[] {labelKey(cells.get(i)), cells.get(i + 1).text().trim()});
                }
            } else if (e.parents().stream().noneMatch(a -> a.normalName().equals("tr"))) {
                Element value = e.nextElementSibling();
                if (value != null) pairs.add(new String[] {labelKey(e), value.text().trim()});
            }
            for (String[] p : pairs) {
                if (p[0] == null) continue;
                if (cur.containsKey(p[0])) {
                    addRecord(out, cur);
                    cur = new LinkedHashMap<>();
                }
                cur.put(p[0], p[1]);
            }
        }
        addRecord(out, cur);
        return out;
    }

    private static String labelKey(Element label) {
        String t = label.text().trim();
        return t.isEmpty() || t.length() > 40 ? null : key(t);
    }

    private static void addRecord(List<CertificateRef> out, Map<String, String> rec) {
        if (!rec.containsKey("description") && !rec.containsKey("period")) return;
        String period = rec.getOrDefault("period", "");
        LocalDateTime[] window = period(period);
        out.add(new CertificateRef(
                nullIfEmpty(rec.getOrDefault("description", "")),
                nullIfEmpty(rec.getOrDefault("type", "")),
                nullIfEmpty(period),
                window[0], window[1],
                dateTime(rec.getOrDefault("certified", ""), false),
                dateTime(rec.getOrDefault("expiry", ""), false),
                null));
    }

    private static String cell(Elements cells, Integer idx) {
        if (idx == null || idx >= cells.size()) return "";
        Element c = cells.get(idx).clone();
        c.select(".ui-column-title").remove(); // responsive tables repeat the column title inside each cell
        return c.text().trim();
    }

    private static String nullIfEmpty(String s) {
        return s.isEmpty() ? null : s;
    }

    /** First usable href in the row (never constructed). "#" and javascript: links are not usable. */
    private static String href(Element row) {
        for (Element a : row.select("a[href]")) {
            String h = a.attr("href").trim();
            if (!h.isEmpty() && !h.startsWith("#") && !h.toLowerCase(Locale.ROOT).startsWith("javascript:")) return h;
        }
        return null;
    }

    /** The first two dd/MM/yyyy[ HH:mm[:ss]] values in the Period text, whatever separates them. Else both null. */
    static LocalDateTime[] period(String text) {
        Matcher m = DATE_TIME.matcher(text);
        if (!m.find()) return new LocalDateTime[] {null, null};
        LocalDateTime from = toDateTime(m, false);
        if (!m.find()) return new LocalDateTime[] {null, null};
        LocalDateTime to = toDateTime(m, true);
        return from == null || to == null ? new LocalDateTime[] {null, null} : new LocalDateTime[] {from, to};
    }

    /** dd/MM/yyyy with optional time. Date-only gives 00:00, or end of day when endOfDay is true. Unparseable gives null. */
    static LocalDateTime dateTime(String text, boolean endOfDay) {
        Matcher m = DATE_TIME.matcher(text);
        return m.find() ? toDateTime(m, endOfDay) : null;
    }

    private static LocalDateTime toDateTime(Matcher m, boolean endOfDay) {
        try {
            LocalDate d = LocalDate.of(Integer.parseInt(m.group(3)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(1)));
            if (m.group(4) == null) return endOfDay ? d.atTime(LocalTime.MAX) : d.atStartOfDay();
            int sec = m.group(6) == null ? 0 : Integer.parseInt(m.group(6));
            return d.atTime(Integer.parseInt(m.group(4)), Integer.parseInt(m.group(5)), sec);
        } catch (DateTimeException e) {
            return null;
        }
    }
}
