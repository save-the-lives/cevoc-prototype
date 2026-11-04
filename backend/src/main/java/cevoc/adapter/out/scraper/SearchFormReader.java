package cevoc.adapter.out.scraper;

import java.net.URI;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

/**
 * Reads the certificates search form from its HTML and builds the POST for it, using ONLY the field names found on
 * the page: every hidden field (view state, form id), the defaults of the other fields, the three search inputs
 * (found by label, then id/name fragment, then position) and the SEARCH button. Nothing here is a guess about ids.
 */
final class SearchFormReader {

    /** What to POST and where; {@code how} says which way each field was found (label|css|order), never a value. */
    record Plan(String actionUrl, Map<String, String> body, String how) {}

    private static final DateTimeFormatter FORMAT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");
    private static final String TEXT_INPUTS =
            "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=image])";

    private SearchFormReader() {}

    static Plan plan(String html, String pageUrl, String locationCode, LocalDateTime from, LocalDateTime to) {
        Document doc = Jsoup.parse(html == null ? "" : html, pageUrl);
        Element form = null;
        for (Element f : doc.select("form")) {
            if (f.select(TEXT_INPUTS).size() >= 3 && viewState(f)) {
                form = f;
                break;
            }
        }
        if (form == null) throw new ScrapeException("no-search-form");
        List<Element> texts = form.select(TEXT_INPUTS);
        String[] how = new String[3];
        Element loc = find(form, texts, "location\\s*code", new String[] {"location"}, 0, how);
        Element dFrom = find(form, texts, "(time|date)\\s*from|\\bfrom\\b", new String[] {"from", "start"}, 1, how);
        Element dTo = find(form, texts, "(time|date)\\s*to\\b", new String[] {"dateto", "timeto", "_to", ":to"}, 2, how);
        if (loc == null || dFrom == null || dTo == null || loc == dFrom || loc == dTo || dFrom == dTo
                || loc.attr("name").isBlank() || dFrom.attr("name").isBlank() || dTo.attr("name").isBlank()) {
            throw new ScrapeException("no-search-form");
        }
        Element button = null;
        for (Element b : form.select("button, input[type=submit], input[type=button]")) {
            String cap = (b.normalName().equals("input") ? b.attr("value") : b.text()).trim().toLowerCase(Locale.ROOT);
            if (cap.equals("search") && !b.attr("name").isBlank()) {
                button = b;
                break;
            }
        }
        if (button == null) throw new ScrapeException("no-search-form");

        Map<String, String> body = new LinkedHashMap<>();
        for (Element e : form.select("input, select, textarea")) {
            String name = e.attr("name");
            if (name.isBlank() || e.hasAttr("disabled")) continue;
            switch (e.normalName()) {
                case "select" -> {
                    Element chosen = e.selectFirst("option[selected]");
                    if (chosen == null) chosen = e.selectFirst("option");
                    if (chosen != null) body.put(name, chosen.hasAttr("value") ? chosen.attr("value") : chosen.text());
                }
                case "textarea" -> body.put(name, e.text());
                default -> {
                    String type = e.attr("type").toLowerCase(Locale.ROOT);
                    if (type.equals("submit") || type.equals("button") || type.equals("image") || type.equals("file")) break;
                    if (type.equals("checkbox") || type.equals("radio")) {
                        if (e.hasAttr("checked")) body.put(name, e.hasAttr("value") ? e.attr("value") : "on");
                    } else {
                        body.put(name, e.attr("value"));
                    }
                }
            }
        }
        body.put(loc.attr("name"), locationCode);
        body.put(dFrom.attr("name"), FORMAT.format(from));
        body.put(dTo.attr("name"), FORMAT.format(to));
        body.put(button.attr("name"), button.attr("value"));

        String action = form.absUrl("action");
        if (action.isEmpty()) action = pageUrl;
        if (!sameHttpsHost(action, pageUrl)) throw new ScrapeException("no-search-form");
        return new Plan(action, body, "loc=" + how[0] + "; from=" + how[1] + "; to=" + how[2]);
    }

    private static boolean viewState(Element form) {
        return form.select("input[type=hidden]").stream().anyMatch(i -> i.attr("name").endsWith("ViewState"));
    }

    private static boolean sameHttpsHost(String a, String b) {
        try {
            URI x = URI.create(a);
            URI y = URI.create(b);
            return "https".equalsIgnoreCase(x.getScheme()) && x.getHost() != null && x.getHost().equalsIgnoreCase(y.getHost());
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static Element find(Element form, List<Element> texts, String labelRegex, String[] fragments, int ordinal, String[] how) {
        int slot = ordinal;
        Pattern p = Pattern.compile(labelRegex, Pattern.CASE_INSENSITIVE);
        for (Element label : form.select("label")) {
            if (!p.matcher(label.text()).find()) continue;
            Element target = null;
            if (!label.attr("for").isBlank()) {
                Element byId = form.getElementById(label.attr("for"));
                if (byId != null && texts.contains(byId)) target = byId;
            } else {
                target = label.selectFirst(TEXT_INPUTS);
            }
            if (target != null) {
                how[slot] = "label";
                return target;
            }
        }
        for (Element in : texts) {
            String key = (in.id() + " " + in.attr("name")).toLowerCase(Locale.ROOT);
            for (String f : fragments) {
                if (key.contains(f)) {
                    how[slot] = "css";
                    return in;
                }
            }
        }
        if (texts.size() > ordinal) {
            how[slot] = "order";
            return texts.get(ordinal);
        }
        how[slot] = "none";
        return null;
    }
}
