package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import au.gov.nsw.transport.cevoc.domain.CertificateRef;
import java.time.LocalDate;
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
 * <p>TODO (Arjan must supply a screenshot or the page source, saved by a person with approval):
 * <ol>
 *   <li>The form id (JSF prefixes component ids with it, e.g. {@code searchForm:penaltyNumber}).</li>
 *   <li>The id/name of the penalty number input, and of the enforcement site number input if any.</li>
 *   <li>The id/name of the search submit button (JSF needs it in the POST, with or without ajax/PrimeFaces partial requests).</li>
 *   <li>Whether the results come back as a table, a data list or a PrimeFaces datatable, and its column order.</li>
 *   <li>Whether the site number is shown in the penalty result (VIA_ENFORCEMENT_SITE) and how it is selected (link, button, row).</li>
 *   <li>How a certificate document is referenced (link href, command link with ViewState, or a download).</li>
 *   <li>The date format shown, and the exact "no results" message.</li>
 *   <li>Whether a captcha or login step exists (if so, stop: do not automate).</li>
 * </ol>
 * The constants below are GUESSES for the fictitious fixtures only. Change them once the real page is known.
 */
public class CertificatePageParser {

    // ---- TODO: replace with real values from the real page ----
    static final String FORM_ID = "searchForm";
    static final String FORM_SELECTOR = "form#searchForm";
    static final String PENALTY_INPUT = "searchForm:penaltyNumber";
    static final String SITE_INPUT = "searchForm:siteNumber";
    static final String SEARCH_BUTTON = "searchForm:searchButton";
    static final String RESULT_ROW_SELECTOR = "table#results tbody tr.certificate-row";
    static final String SITE_ROW_SELECTOR = "table#sites tbody tr.site-row";
    static final String NO_RESULTS_SELECTOR = ".no-results";
    static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    // ------------------------------------------------------------

    /** What a POST needs: where to submit and the hidden fields (including javax.faces.ViewState). */
    public record FormState(String actionUrl, String viewState, Map<String, String> hiddenFields) {}

    public record SiteRef(String siteNumber, String selectorField) {}

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

    /** Builds the POST body for a search: hidden fields (fresh ViewState) plus the key and the button. */
    public Map<String, String> buildSearchPost(FormState state, String penaltyNumber, String siteNumber) {
        Map<String, String> post = new LinkedHashMap<>(state.hiddenFields());
        post.put(FORM_ID, FORM_ID);
        post.put(PENALTY_INPUT, penaltyNumber);
        if (siteNumber != null) post.put(SITE_INPUT, siteNumber);
        post.put(SEARCH_BUTTON, "");
        return post;
    }

    public boolean hasNoResults(String html) {
        return Jsoup.parse(html).selectFirst(NO_RESULTS_SELECTOR) != null;
    }

    /** Enforcement site numbers listed for a penalty (VIA_ENFORCEMENT_SITE). Empty when none. */
    public List<SiteRef> parseSites(String html) {
        List<SiteRef> out = new ArrayList<>();
        for (Element row : Jsoup.parse(html).select(SITE_ROW_SELECTOR)) {
            String number = text(row, ".site-number");
            if (!number.isEmpty()) out.add(new SiteRef(number, row.select("input[type=hidden]").attr("name")));
        }
        return out;
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
