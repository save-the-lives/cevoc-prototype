package cevoc.adapter.out.scraper;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

/**
 * STRUCTURE-ONLY description of the certificates search page, for the owner's live check: element ids and names (the
 * page template's, not values), labels and button captions only when they belong to a fixed vocabulary (anything else
 * is "other"), counts, status-like yes/no markers. It never contains a value typed into the page, a result cell, or
 * free page text.
 */
public final class SearchPageDiagnostic {

    private static final Set<String> LABELS = Set.of("location code", "date/time from", "date/time to", "date time from",
            "date time to", "date from", "date to", "from", "to", "location", "certificate type");
    private static final String[] MESSAGE_WORDS = {"no record", "no result", "no data", "no certificate", "not found",
            "required", "invalid", "mandatory", "error", "must", "format", "too many", "unavailable", "denied", "captcha", "session"};

    private SearchPageDiagnostic() {}

    public static String structureOf(String html) {
        try {
            Document d = Jsoup.parse(html == null ? "" : html);
            StringBuilder sb = new StringBuilder("html=").append(bucket(html == null ? 0 : html.length()));
            String body = d.body() == null ? "" : d.body().text().toLowerCase(Locale.ROOT);
            sb.append("; body-text=").append(bucket(body.length()));
            sb.append("; forms=").append(Math.min(d.select("form").size(), 9));
            List<String> formIds = new ArrayList<>();
            for (Element f : d.select("form")) {
                if (formIds.size() < 3) formIds.add(token(f.id()));
            }
            sb.append("; form-ids=").append(formIds.isEmpty() ? "none" : String.join(",", formIds));

            List<String> inputs = new ArrayList<>();
            for (Element in : d.select("input")) {
                String type = in.attr("type").toLowerCase(Locale.ROOT);
                if ("hidden".equals(type) || "submit".equals(type) || "button".equals(type)) continue;
                if (inputs.size() < 10) {
                    inputs.add((type.isEmpty() ? "text" : token(type)) + "#" + token(in.id()) + "|" + token(in.attr("name")));
                }
            }
            sb.append("; visible-inputs=").append(inputs.isEmpty() ? "none" : String.join(",", inputs));
            TreeSet<String> hidden = new TreeSet<>();
            for (Element in : d.select("input[type=hidden]")) {
                if (hidden.size() < 10) hidden.add(token(in.attr("name")));
            }
            sb.append("; hidden-names=").append(hidden.isEmpty() ? "none" : String.join(",", hidden));

            TreeSet<String> labels = new TreeSet<>();
            int labelFor = 0;
            int labelForResolved = 0;
            for (Element e : d.select("label, td, th, span, div, legend")) {
                if (e.children().size() > 1) continue;
                String t = e.ownText().replace(":", "").replace("*", "").replaceAll("\\s+", " ").trim().toLowerCase(Locale.ROOT);
                if (!t.isEmpty() && t.length() <= 20 && LABELS.contains(t)) labels.add(t.replace(' ', '-'));
            }
            for (Element l : d.select("label[for]")) {
                labelFor++;
                if (!d.select("[id=\"" + l.attr("for").replace("\"", "") + "\"]").isEmpty()) labelForResolved++;
            }
            sb.append("; labels=").append(labels.isEmpty() ? "none" : String.join(",", labels));
            sb.append("; label-for=").append(Math.min(labelFor, 99)).append("/").append(Math.min(labelForResolved, 99));

            List<String> buttons = new ArrayList<>();
            for (Element b : d.select("button, input[type=submit], input[type=button], a.ui-button, a[role=button]")) {
                if (buttons.size() >= 10) break;
                String cap = (b.normalName().equals("input") ? b.attr("value") : b.text()).trim().toLowerCase(Locale.ROOT);
                String v = cap.equals("search") ? "search" : cap.equals("clear") ? "clear" : cap.equals("close") ? "close" : "other";
                buttons.add(v + "#" + token(b.id()));
            }
            sb.append("; buttons=").append(buttons.isEmpty() ? "none" : String.join(",", buttons));

            List<String> selects = new ArrayList<>();
            for (Element s : d.select("select")) {
                if (selects.size() < 6) selects.add(token(s.id()) + "=" + Math.min(s.select("option").size(), 99));
            }
            sb.append("; selects=").append(selects.isEmpty() ? "none" : String.join(",", selects));

            List<String> tables = new ArrayList<>();
            for (Element t : d.select("table")) {
                if (tables.size() >= 6) break;
                tables.add("th" + Math.min(t.select("th").size(), 99) + "/tr" + Math.min(t.select("tr:has(td)").size(), 99)
                        + "/td" + Math.min(t.select("td").size(), 999) + "/col" + Math.min(t.select("tr:has(td)").stream()
                                .mapToInt(r -> r.children().size()).max().orElse(0), 99)
                        + (t.select("td[colspan]").isEmpty() ? "" : "/colspan"));
            }
            sb.append("; tables=").append(tables.isEmpty() ? "none" : String.join(",", tables));
            List<String> heads = new ArrayList<>();
            for (Element th : d.select("th")) {
                if (heads.size() < 12) heads.add(headerVocab(th.text()));
            }
            sb.append("; headers=").append(heads.isEmpty() ? "none" : String.join(",", heads));

            sb.append("; datatable=").append(yn(!d.select(".ui-datatable").isEmpty()));
            sb.append("; empty-marker=").append(yn(!d.select(".ui-datatable-empty-message, .no-results").isEmpty()));
            sb.append("; paginator=").append(yn(!d.select(".ui-paginator").isEmpty()));
            sb.append("; calendar-widget=").append(yn(!d.select(".ui-datepicker, .hasDatepicker, .ui-calendar, .p-calendar").isEmpty()));
            sb.append("; message-boxes=").append(Math.min(d.select(".ui-messages, .ui-message, .ui-growl, .alert, [role=alert]").size(), 9));
            sb.append("; error-class=").append(yn(!d.select(".ui-state-error, .ui-messages-error, .ui-message-error, .error").isEmpty()));
            sb.append("; iframes=").append(Math.min(d.select("iframe").size(), 9));
            sb.append("; captcha=").append(yn(captcha(d, body)));
            sb.append("; password-field=").append(yn(!d.select("input[type=password]").isEmpty()));
            sb.append("; viewstate=").append(yn(html != null && html.contains("ViewState")));
            TreeSet<String> words = new TreeSet<>();
            for (String w : MESSAGE_WORDS) {
                if (body.contains(w)) words.add(w.replace(' ', '-'));
            }
            sb.append("; message-words=").append(words.isEmpty() ? "none" : String.join(",", words));
            return sb.toString();
        } catch (RuntimeException e) {
            return "structure=unreadable";
        }
    }

    private static final Set<String> SERVER_PRODUCTS = Set.of("nginx", "apache", "microsoft-iis", "cloudflare", "akamaighost",
            "akamainetworkstorage", "awselb", "amazons3", "cloudfront", "envoy", "openresty", "varnish", "litespeed",
            "gws", "azure", "microsoft-httpapi", "bigip", "f5", "imperva", "incapsula", "sucuri", "netscaler", "squid");

    /**
     * Facts about a refused response and the request that drew it, with NO values: header names only (lower-cased,
     * sorted), the server product token only when it is a known plain product name, the media type without
     * parameters, size bucket, html yes/no, the client category and yes/no for referer/origin. Never cookies,
     * tokens, URLs, the user agent string or any body text.
     */
    public static String refusalProfile(Map<String, String> responseHeaders, String body, String clientMode,
                                        String userAgentCategory, boolean sentReferer, boolean sentOrigin) {
        return refusalProfile("srch-refusal-profile", "n/a", responseHeaders, body == null ? 0 : body.length(), looksHtml(body),
                clientMode, userAgentCategory, sentReferer, sentOrigin);
    }

    /** Failure marker: the exception CLASS name only, never its message. */
    public static String refusalProfileUnavailable(String label, Throwable t) {
        String n = t == null ? "none" : t.getClass().getSimpleName();
        return label + ": unavailable; error-class=" + (n.matches("[A-Za-z0-9_]{1,60}") ? n : "other");
    }

    private static boolean looksHtml(String body) {
        if (body == null) return false;
        String b = body.toLowerCase(Locale.ROOT);
        return b.contains("<html") || b.contains("<body") || b.contains("<!doctype html");
    }

    /** As above, from a size and an html flag (for a body held as bytes), with a host category (same|revenue-nsw-api|other). */
    public static String refusalProfile(String label, String hostCategory, Map<String, String> responseHeaders, int bodyLength,
                                        boolean bodyHtml, String clientMode, String userAgentCategory,
                                        boolean sentReferer, boolean sentOrigin) {
        try {
            TreeSet<String> names = new TreeSet<>();
            String server = null;
            String type = null;
            if (responseHeaders != null) {
                for (Map.Entry<String, String> h : responseHeaders.entrySet()) {
                    String n = h.getKey() == null ? "" : h.getKey().toLowerCase(Locale.ROOT).trim();
                    if (!n.matches("[a-z0-9\\-]{1,40}")) continue;
                    names.add(n);
                    if (n.equals("server")) server = serverProduct(h.getValue());
                    if (n.equals("content-type")) type = mediaType(h.getValue());
                }
            }
            return label + ": host=" + (hostCategory == null ? "unknown" : token(hostCategory)) + "; header-names=" + (names.isEmpty() ? "none" : String.join(",", names.stream().limit(40).toList()))
                    + "; server=" + (server == null ? "omitted" : server)
                    + "; content-type=" + (type == null ? "none" : type)
                    + "; body-size=" + sizeBucket(bodyLength) + "; body-html=" + yn(bodyHtml)
                    + "; client=" + (clientMode == null ? "unknown" : token(clientMode))
                    + "; user-agent=" + (userAgentCategory == null ? "unknown" : token(userAgentCategory))
                    + "; sent-referer=" + yn(sentReferer) + "; sent-origin=" + yn(sentOrigin);
        } catch (RuntimeException e) {
            return label + ": unreadable";
        }
    }

    private static String serverProduct(String value) {
        if (value == null) return null;
        String product = value.trim().toLowerCase(Locale.ROOT).split("[/\\s(;]", 2)[0];
        return SERVER_PRODUCTS.contains(product) ? product : null;
    }

    private static String mediaType(String value) {
        if (value == null) return null;
        String m = value.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        return m.matches("[a-z0-9.+\\-]{1,30}/[a-z0-9.+\\-]{1,40}") ? m : "other";
    }

    private static String sizeBucket(int n) {
        return n < 512 ? "<512B" : n < 2_048 ? "<2KB" : n < 10_240 ? "<10KB" : ">=10KB";
    }

    /** True when the page shows a captcha widget: the search must stop there, never be automated past it. */
    public static boolean hasCaptcha(String html) {
        try {
            Document d = Jsoup.parse(html == null ? "" : html);
            return captcha(d, d.body() == null ? "" : d.body().text().toLowerCase(Locale.ROOT));
        } catch (RuntimeException e) {
            return false;
        }
    }

    private static boolean captcha(Document d, String bodyLower) {
        return !d.select("iframe[src*=recaptcha], iframe[src*=hcaptcha], .g-recaptcha, .h-captcha, [class*=captcha], [id*=captcha]").isEmpty()
                || bodyLower.contains("captcha");
    }

    private static String headerVocab(String text) {
        String h = text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
        if (h.contains("description")) return "description";
        if (h.contains("type")) return "type";
        if (h.contains("period")) return "period";
        if (h.contains("certified")) return "certified";
        if (h.contains("expiry")) return "expiry";
        return "other";
    }

    /** Element ids and names are template identifiers; keep only plain characters, bounded. */
    private static String token(String s) {
        if (s == null || s.isBlank()) return "-";
        String t = s.trim();
        return t.length() <= 60 && t.matches("[A-Za-z0-9:_.\\-]+") ? t : "other";
    }

    private static String bucket(int n) {
        return n == 0 ? "0" : n < 2_000 ? "<2k" : n < 20_000 ? "<20k" : n < 200_000 ? "<200k" : ">=200k";
    }

    private static String yn(boolean b) {
        return b ? "yes" : "no";
    }
}
