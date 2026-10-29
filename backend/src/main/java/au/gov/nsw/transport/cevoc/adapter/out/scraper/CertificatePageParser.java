package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

/**
 * The ONLY class that knows the JSF page's HTML. Everything else works with the small records below.
 *
 * <p>Known from the owner's screenshot of the real page ("Customer Enquiry and Verification of Certificate"):
 * mandatory fields "Location code" (short text), "Date/Time from" and "Date/Time to" (both dd/MM/yyyy HH:mm
 * with a calendar picker; "to" is pre-filled with the current date/time); buttons SEARCH, CLEAR, CLOSE.
 *
 * <p>TODO (owner to supply the saved page source or the results screenshot; a person saves it, with approval):
 * <ol>
 *   <li>The REAL JSF ids/names: form id, location code input, date from, date to, SEARCH button. The constants below
 *       are GUESSES that only match the fictitious fixtures. Real ids come from the page source.</li>
 *   <li>The results layout (table / data list / PrimeFaces datatable) and column order.</li>
 *   <li>How a certificate document is exposed (link href, command link with ViewState, or a download).</li>
 *   <li>The date format in results and the exact "no results" message.</li>
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
    static final String RESULT_ROW_SELECTOR = "table#results tbody tr.certificate-row";
    static final String NO_RESULTS_SELECTOR = ".no-results";
    // ----------------------------------------------------------------------------
    /** Format shown on the real page's date/time fields (known). */
    static final DateTimeFormatter DATE_TIME_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    /** Result date format: unknown, guess. */
    static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

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

    public List<CertificateRef> parseCertificates(String html) {
        List<CertificateRef> out = new ArrayList<>();
        for (Element row : Jsoup.parse(html).select(RESULT_ROW_SELECTOR)) {
            String number = text(row, ".cert-number");
            if (number.isEmpty()) continue;
            out.add(new CertificateRef(number, text(row, ".cert-title"), date(text(row, ".cert-date")),
                    row.select("a.cert-link").attr("href")));
        }
        return out;
    }

    private static String text(Element row, String css) {
        Element e = row.selectFirst(css);
        return e == null ? "" : e.text().trim();
    }

    private static LocalDate date(String s) {
        if (s.isEmpty()) return null;
        try {
            return LocalDate.parse(s, DATE_FORMAT);
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
