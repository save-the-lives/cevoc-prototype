package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Scrubs values the browser layer might echo in an error message (notice number, date, plate). Keeps only the
 * first line (Playwright appends a call log) and caps the length. Per-session; discard with the session.
 */
public final class Redactor {

    private static final int MAX = 200;
    private final CopyOnWriteArrayList<String> secrets = new CopyOnWriteArrayList<>();

    public void add(String secret) {
        if (secret != null && secret.strip().length() >= 3) {
            secrets.add(secret.strip());
        }
    }

    public void clear() {
        secrets.clear();
    }

    public String clean(String message) {
        if (message == null) {
            return "";
        }
        String s = message.lines().findFirst().orElse("");
        for (String secret : secrets) {
            int i;
            String lower = s.toLowerCase(Locale.ROOT);
            String ls = secret.toLowerCase(Locale.ROOT);
            while ((i = lower.indexOf(ls)) >= 0) {
                s = s.substring(0, i) + "***" + s.substring(i + secret.length());
                lower = s.toLowerCase(Locale.ROOT);
            }
        }
        return s.length() > MAX ? s.substring(0, MAX) + "..." : s;
    }
}
