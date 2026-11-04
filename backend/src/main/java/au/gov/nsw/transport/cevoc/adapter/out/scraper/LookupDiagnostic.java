package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A short, fixed-vocabulary reason for why one lookup ended UNAVAILABLE, for the owner's live check only. It holds
 * the step name, a whitelisted cause token and coarse yes/no page markers, never page text, never any value the
 * owner typed. Kept in a thread-local for one call (like {@link RequestScopedRegistration}); nothing reads it
 * outside the live-check endpoint.
 */
public final class LookupDiagnostic {

    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();
    private static final Pattern STEP = Pattern.compile("browser step '([a-z-]{1,20})' failed");
    private static final Pattern NET = Pattern.compile("net::(ERR_[A-Z_]{1,40})");
    private static final Pattern CLASS_ONLY = Pattern.compile("failed: ([A-Za-z]{1,40})$");

    private LookupDiagnostic() {}

    public static void clear() {
        CURRENT.remove();
    }

    public static void set(String reason) {
        CURRENT.set(reason);
    }

    /** Adds one fixed-vocabulary marker (token=yes/no/number) to the reason being built on this thread. */
    public static void note(String marker) {
        String cur = CURRENT.get();
        CURRENT.set(cur == null ? marker : cur + "; " + marker);
    }

    /** Page structure markers (counts, field keys, yes/no) for a page that was readable but not the expected one. */
    public static String structureOf(String html) {
        return structure(html == null ? "" : html).replaceFirst("^; ", "");
    }

    /** Returns the reason recorded on this thread (or null) and forgets it. */
    public static String take() {
        String v = CURRENT.get();
        CURRENT.remove();
        return v;
    }

    /** Maps an exception message from the browser layer onto the fixed vocabulary. */
    public static String fromFailure(String message) {
        String m = message == null ? "" : message.lines().findFirst().orElse("");
        StringBuilder sb = new StringBuilder();
        Matcher step = STEP.matcher(m);
        if (m.startsWith("could not start the browser")) {
            sb.append("step=start");
        } else if (step.find()) {
            sb.append("step=").append(step.group(1));
        } else {
            sb.append("step=unknown");
        }
        sb.append("; cause=");
        Matcher net = NET.matcher(m);
        String lower = m.toLowerCase(Locale.ROOT);
        if (net.find()) {
            sb.append(net.group(1));
        } else if (lower.contains("timeout")) {
            sb.append("timeout");
        } else if (lower.contains("executable doesn't exist") || lower.contains("playwright was just installed")) {
            sb.append("browser-not-installed");
        } else if (lower.contains("no matching button")) {
            sb.append("button-not-found");
        } else if (lower.contains("target page, context or browser has been closed") || lower.contains("browser has been closed")) {
            sb.append("browser-closed");
        } else if (lower.contains("failed to launch") || lower.contains("browsertype.launch")) {
            sb.append("browser-launch-failed");
        } else if (lower.contains("strict mode violation")) {
            sb.append("selector-matches-many");
        } else {
            Matcher c = CLASS_ONLY.matcher(m);
            sb.append(c.find() ? c.group(1) : "other");
        }
        return sb.toString();
    }

    /** Coarse markers of an unreadable page: yes/no flags and a size bucket, no text. */
    public static String fromUnreadablePage(String where, String html) {
        String h = html == null ? "" : html;
        String lower = h.toLowerCase(Locale.ROOT);
        return "page not recognised at " + where + "; html-size=" + bucket(h.length())
                + "; has-pnn-field=" + yn(lower.contains("pnn"))
                + "; has-date-field=" + yn(lower.contains("dateofoffence"))
                + "; has-next-button=" + yn(lower.contains("next"))
                + "; has-penalty-notice-heading=" + yn(lower.contains("penalty notice number"))
                + structure(h)
                + "; looks-blocked=" + yn(lower.contains("access denied") || lower.contains("captcha")
                        || lower.contains("forbidden") || lower.contains("unusual traffic"));
    }

    /**
     * Structure of the certificates page reached by the browser route: counts, header labels from a fixed vocabulary
     * (anything else is "other"), yes/no markers. Never any text or value from the page.
     */
    public static String certPageStructureOf(String html) {
        try {
            org.jsoup.nodes.Document d = org.jsoup.Jsoup.parse(html == null ? "" : html);
            StringBuilder sb = new StringBuilder("cert-html-size=").append(bucket(html == null ? 0 : html.length()));
            sb.append("; cert-body-text=").append(bucket(d.body() == null ? 0 : d.body().text().length()));
            sb.append("; cert-tables=").append(Math.min(d.select("table").size(), 9));
            sb.append("; cert-rows=").append(Math.min(d.select("tbody tr, table tr:has(td)").size(), 99));
            sb.append("; cert-headers=");
            java.util.List<String> heads = new java.util.ArrayList<>();
            for (org.jsoup.nodes.Element th : d.select("th")) {
                if (heads.size() >= 12) break;
                heads.add(vocab(th.text()));
            }
            sb.append(heads.isEmpty() ? "none" : String.join(",", heads));
            sb.append("; cert-label-cells=");
            java.util.TreeSet<String> labels = new java.util.TreeSet<>();
            for (org.jsoup.nodes.Element e : d.select("td, dt, label, span")) {
                String t = e.ownText().trim();
                if (!t.isEmpty() && t.length() <= 40 && e.select("td, dt, label").size() <= 1) {
                    String v = vocab(t);
                    if (!"other".equals(v)) labels.add(v);
                }
            }
            sb.append(labels.isEmpty() ? "none" : String.join(",", labels));
            sb.append("; cert-datatable-class=").append(yn(!d.select(".ui-datatable, .dataTable, table.table").isEmpty()));
            sb.append("; cert-empty-marker=").append(yn(!d.select(".no-results, .ui-datatable-empty-message").isEmpty()));
            sb.append("; cert-paginator=").append(yn(!d.select(".ui-paginator, .pagination, .paginator").isEmpty()));
            sb.append("; cert-forms=").append(Math.min(d.select("form").size(), 9));
            sb.append("; cert-inputs=").append(Math.min(d.select("input").size(), 20));
            sb.append("; cert-buttons=").append(Math.min(d.select("button, input[type=submit], input[type=button]").size(), 20));
            sb.append("; cert-links=").append(Math.min(d.select("a[href]").size(), 99));
            int locFields = 0;
            int dateFields = 0;
            for (org.jsoup.nodes.Element in : d.select("input")) {
                String idn = (in.id() + " " + in.attr("name")).toLowerCase(Locale.ROOT);
                if (idn.contains("location")) locFields++;
                if (idn.contains("date")) dateFields++;
            }
            sb.append("; cert-location-field=").append(yn(locFields > 0));
            sb.append("; cert-date-fields=").append(Math.min(dateFields, 9));
            sb.append("; cert-viewstate=").append(yn(html != null && html.contains("ViewState")));
            sb.append("; cert-password-field=").append(yn(!d.select("input[type=password]").isEmpty()));
            sb.append("; cert-blocked-words=").append(yn(blockedWords(d.body() == null ? "" : d.body().text().toLowerCase(Locale.ROOT))));
            return sb.toString();
        } catch (RuntimeException e) {
            return "cert-structure=unreadable";
        }
    }

    /** Maps a header or label text onto a fixed vocabulary; everything unknown is "other". */
    private static String vocab(String text) {
        String h = text == null ? "" : text.trim().toLowerCase(Locale.ROOT);
        if (h.contains("description")) return "description";
        if (h.contains("type")) return "type";
        if (h.contains("period")) return "period";
        if (h.contains("certified")) return "certified";
        if (h.contains("expiry")) return "expiry";
        if (h.contains("location")) return "location";
        if (h.contains("status")) return "status";
        if (h.contains("action") || h.contains("view")) return "action";
        if (h.contains("date")) return "date";
        if (h.contains("number") || h.equals("no") || h.equals("no.")) return "number";
        return "other";
    }

    /** One fixed-vocabulary certificates step marker: step name, outcome ok|failed|skipped, whitelisted cause token. */
    public static String certStep(String outcome, String cause) {
        return "step=certificates; outcome=" + outcome + (cause == null ? "" : "; cause=" + cause);
    }

    private static final String[] KNOWN_FIELDS = {"pnn", "dateOfOffence", "lastName", "vehicleNumber"};

    /** Element structure only: counts and which known field keys appear as name/id/formcontrolname. */
    private static String structure(String html) {
        try {
            org.jsoup.nodes.Document d = org.jsoup.Jsoup.parse(html);
            StringBuilder sb = new StringBuilder();
            sb.append("; inputs=").append(Math.min(d.select("input").size(), 20));
            sb.append("; forms=").append(Math.min(d.select("form").size(), 9));
            sb.append("; buttons=").append(Math.min(d.select("button, input[type=submit]").size(), 20));
            sb.append("; imgs=").append(Math.min(d.select("img").size(), 40));
            sb.append("; blob-imgs=").append(Math.min(d.select("img[src^=blob:]").size(), 40));
            sb.append("; iframes=").append(Math.min(d.select("iframe").size(), 9));
            sb.append("; app-root=").append(yn(!d.select("app-root, #root, #app").isEmpty()));
            sb.append("; body-text=").append(bucket(d.body() == null ? 0 : d.body().text().length()));
            for (String k : KNOWN_FIELDS) {
                sb.append("; ").append(k).append("-by=")
                        .append(yn(!d.select("input[name=" + k + "]").isEmpty())).append("/")
                        .append(yn(!d.select("input#" + k).isEmpty())).append("/")
                        .append(yn(!d.select("input[formcontrolname=" + k + "]").isEmpty()));
            }
            sb.append("; input-types=");
            java.util.TreeSet<String> types = new java.util.TreeSet<>();
            for (org.jsoup.nodes.Element e : d.select("input")) {
                String t = e.attr("type").toLowerCase(Locale.ROOT);
                types.add(java.util.Set.of("text", "hidden", "tel", "date", "number", "checkbox", "submit", "password", "email").contains(t) ? t : (t.isEmpty() ? "none" : "other"));
            }
            sb.append(String.join(",", types));
            sb.append("; visible-blocked-words=").append(yn(blockedWords(d.body() == null ? "" : d.body().text().toLowerCase(Locale.ROOT))));
            return sb.toString();
        } catch (RuntimeException e) {
            return "; structure=unreadable";
        }
    }

    private static boolean blockedWords(String t) {
        return t.contains("access denied") || t.contains("captcha") || t.contains("forbidden") || t.contains("unusual traffic");
    }

    private static String bucket(int n) {
        return n == 0 ? "0" : n < 2_000 ? "<2k" : n < 20_000 ? "<20k" : n < 200_000 ? "<200k" : ">=200k";
    }

    private static String yn(boolean b) {
        return b ? "yes" : "no";
    }
}
