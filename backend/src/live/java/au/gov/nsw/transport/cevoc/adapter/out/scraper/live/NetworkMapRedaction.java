package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;

/**
 * Pure, conservative redaction for the network map. Everything here turns a request or response into STRUCTURE only:
 * path patterns, key names, value types, sizes. The repo and its logs are public, so every rule errs towards "?".
 * No value from a payload (string, number, date, name, token) is ever returned; only fixed words, counts and key
 * names that pass a strict whitelist.
 */
public final class NetworkMapRedaction {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Pattern KEY_OK = Pattern.compile("[A-Za-z_][A-Za-z0-9_]{0,39}");
    private static final Pattern HEADER_OK = Pattern.compile("[a-z][a-z0-9-]{0,39}");
    private static final Pattern LABEL_OK = Pattern.compile("[a-z0-9-]{1,40}");
    private static final Pattern UUID = Pattern.compile("(?i)[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}");
    private static final Pattern WORD_SEGMENT = Pattern.compile("[A-Za-z][A-Za-z_-]{0,29}");
    private static final Pattern CONTENT_TYPE_OK = Pattern.compile("[a-z0-9.+-]{1,40}/[a-z0-9.+-]{1,60}");
    private static final Pattern JWT = Pattern.compile("eyJ[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]{5,}\\.[A-Za-z0-9_-]*");
    private static final Pattern ISO_DATE = Pattern.compile("\\d{4}-\\d{2}-\\d{2}([T ].*)?|\\d{1,2}/\\d{1,2}/\\d{4}.*");
    private static final int MAX_DEPTH = 6;
    private static final int MAX_KEYS = 25;
    private static final int MAX_SHAPE = 1500;

    private NetworkMapRedaction() {}

    // ---- URL parts ----

    /** Host name with any label that is not a plain short word-like label replaced by "?". */
    public static String host(String host) {
        if (host == null || host.isBlank()) {
            return "?";
        }
        String[] labels = host.toLowerCase(Locale.ROOT).split("\\.", -1);
        if (labels.length > 8) {
            return "?";
        }
        List<String> out = new ArrayList<>();
        for (String l : labels) {
            if (!LABEL_OK.matcher(l).matches() || digitRun(l) >= 4 || l.length() > 30 && digits(l) > 0) {
                out.add("?");
            } else {
                out.add(l);
            }
        }
        return String.join(".", out);
    }

    /** Path with every id-like segment replaced by {uuid}, {n} or {id}. Only plain word segments survive. */
    public static String path(String path) {
        if (path == null || path.isEmpty() || "/".equals(path)) {
            return "/";
        }
        String[] segs = path.split("/", -1);
        StringBuilder sb = new StringBuilder();
        int kept = 0;
        for (String s : segs) {
            if (s.isEmpty()) {
                continue;
            }
            if (++kept > 12) {
                sb.append("/...");
                break;
            }
            sb.append('/').append(segment(s));
        }
        return sb.length() == 0 ? "/" : sb.toString();
    }

    static String segment(String s) {
        if (UUID.matcher(s).matches()) {
            return "{uuid}";
        }
        if (s.chars().allMatch(Character::isDigit)) {
            return "{n}";
        }
        if (s.matches("v[0-9]{1,2}")) {
            return s; // API version segment such as v1
        }
        // Plain lowercase-initial words (api, notices, images, getImages, view-images) are kept; a trailing file
        // extension of 1-5 letters is allowed for static files. Everything else is an identifier of some kind.
        String stem = s;
        String ext = "";
        int dot = s.lastIndexOf('.');
        if (dot > 0 && s.length() - dot <= 6 && s.indexOf('.') == dot) {
            stem = s.substring(0, dot);
            ext = s.substring(dot);
            if (!ext.matches("\\.[a-z]{1,5}")) {
                return "{id}";
            }
        }
        if (WORD_SEGMENT.matcher(stem).matches() && !isAllUpper(stem) && !looksRandom(stem)) {
            return stem + ext;
        }
        return "{id}";
    }

    /** Query string reduced to key NAMES only (sorted, whitelisted), as "?a&b", or "" when none. */
    public static String queryKeys(String query) {
        if (query == null || query.isEmpty()) {
            return "";
        }
        Set<String> keys = new TreeSet<>();
        for (String pair : query.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }
            int eq = pair.indexOf('=');
            keys.add(key(eq < 0 ? pair : pair.substring(0, eq)));
            if (keys.size() >= 15) {
                break;
            }
        }
        return keys.isEmpty() ? "" : "?" + String.join("&", keys);
    }

    /** Splits an absolute URL into redacted "host path?keys". Unparseable input gives "?". */
    public static String url(String url) {
        try {
            URI u = URI.create(url);
            return host(u.getHost()) + " " + path(u.getRawPath()) + queryKeys(u.getRawQuery());
        } catch (RuntimeException e) {
            return "?";
        }
    }

    // ---- keys and header names ----

    /** A key name is kept only if it is a plain identifier that cannot be an id, token, notice number or plate. */
    public static String key(String raw) {
        String k = raw == null ? "" : decode(raw);
        if (!KEY_OK.matcher(k).matches()) {
            return "?";
        }
        if (digits(k) >= 4 || digitRun(k) >= 3 || k.length() > 32) {
            return "?";
        }
        if (isAllUpperOrDigit(k) && digits(k) > 0 && k.length() >= 4) {
            return "?";
        }
        if (looksRandom(k)) {
            return "?";
        }
        return k;
    }

    public static String headerName(String raw) {
        String h = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        return HEADER_OK.matcher(h).matches() && digitRun(h) < 4 ? h : "?";
    }

    public static String contentType(String raw) {
        if (raw == null || raw.isBlank()) {
            return "none";
        }
        String main = raw.split(";", 2)[0].trim().toLowerCase(Locale.ROOT);
        return CONTENT_TYPE_OK.matcher(main).matches() ? main : "?";
    }

    /** Authorization scheme word only (bearer, basic, other, none). Never the credential. */
    public static String authScheme(String authorizationValue) {
        if (authorizationValue == null || authorizationValue.isBlank()) {
            return "none";
        }
        String first = authorizationValue.trim().split("\\s+", 2)[0].toLowerCase(Locale.ROOT);
        return first.equals("bearer") || first.equals("basic") ? first : "other";
    }

    // ---- sizes ----

    public static String sizeBucket(long bytes) {
        if (bytes < 0) {
            return "unknown";
        }
        return bytes == 0 ? "0" : bytes < 1_000 ? "<1KB" : bytes < 10_000 ? "<10KB" : bytes < 100_000 ? "<100KB"
                : bytes < 250_000 ? "<250KB" : bytes < 500_000 ? "<500KB" : bytes < 1_000_000 ? "<1MB"
                : bytes < 2_000_000 ? "<2MB" : bytes < 5_000_000 ? "<5MB" : ">=5MB";
    }

    /** Pixel size "WxH" read from the image header, or "unknown". Dimensions only, no pixel data is kept. */
    public static String pixelSize(byte[] data) {
        if (data == null || data.length < 24) {
            return "unknown";
        }
        try (var in = javax.imageio.ImageIO.createImageInputStream(new java.io.ByteArrayInputStream(data))) {
            var readers = javax.imageio.ImageIO.getImageReaders(in);
            if (readers.hasNext()) {
                var r = readers.next();
                try {
                    r.setInput(in, true, true);
                    return r.getWidth(0) + "x" + r.getHeight(0);
                } finally {
                    r.dispose();
                }
            }
        } catch (java.io.IOException | RuntimeException e) {
            // fall through
        }
        return "unknown";
    }

    // ---- body shapes ----

    /** Shape of a JSON body as a key tree with value types, or "not-json". Never contains a value. */
    public static String jsonShape(String body) {
        if (body == null || body.isBlank()) {
            return "empty";
        }
        try {
            JsonNode n = JSON.readTree(body);
            if (n == null || n.isMissingNode()) {
                return "empty";
            }
            String s = shape(n, 0);
            return s.length() > MAX_SHAPE ? s.substring(0, MAX_SHAPE) + "..." : s;
        } catch (Exception e) {
            return "not-json";
        }
    }

    /** Key NAMES of a form-urlencoded body, whitelisted, with every value dropped. */
    public static String formShape(String body) {
        if (body == null || body.isBlank()) {
            return "empty";
        }
        String q = queryKeys(body);
        return q.isEmpty() ? "form{}" : "form{" + q.substring(1).replace('&', ',') + "}";
    }

    /** True if the JSON text contains a JWT-looking string value anywhere. Boolean only. */
    public static boolean hasJwtValue(String body) {
        try {
            return containsJwt(JSON.readTree(body));
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean containsJwt(JsonNode n) {
        if (n == null) {
            return false;
        }
        if (n.isTextual()) {
            return JWT.matcher(n.asText()).matches();
        }
        for (JsonNode c : n) {
            if (containsJwt(c)) {
                return true;
            }
        }
        return false;
    }

    static String shape(JsonNode n, int depth) {
        if (n.isNull()) {
            return "null";
        }
        if (n.isBoolean()) {
            return "bool";
        }
        if (n.isNumber()) {
            return "number";
        }
        if (n.isTextual()) {
            return stringKind(n.asText());
        }
        if (depth >= MAX_DEPTH) {
            return n.isArray() ? "array<" + n.size() + ">" : "object";
        }
        if (n.isArray()) {
            Set<String> distinct = new LinkedHashSet<>();
            int i = 0;
            for (JsonNode c : n) {
                distinct.add(shape(c, depth + 1));
                if (++i >= 5) {
                    break;
                }
            }
            return "array<" + n.size() + ">" + (distinct.isEmpty() ? "" : "[" + String.join("|", distinct) + "]");
        }
        if (n.isObject()) {
            if (n.size() > MAX_KEYS) {
                return "object<" + n.size() + " keys>";
            }
            List<String> parts = new ArrayList<>();
            var it = n.fields();
            while (it.hasNext()) {
                var e = it.next();
                parts.add(key(e.getKey()) + ":" + shape(e.getValue(), depth + 1));
            }
            return "{" + String.join(",", parts) + "}";
        }
        return "?";
    }

    /**
     * Type of a string value. Mostly just "string"; a few structural kinds are named because they matter for
     * feasibility (a JWT or a link in a body) and carry no value. A link shows only its redacted host, path pattern
     * and query key names.
     */
    static String stringKind(String s) {
        if (JWT.matcher(s).matches()) {
            return "string:jwt";
        }
        if (UUID.matcher(s).matches()) {
            return "string:uuid";
        }
        if (s.startsWith("https://") || s.startsWith("http://") || s.startsWith("/") && s.length() > 1 && !s.contains(" ")) {
            if (s.length() < 2000 && !s.contains(" ")) {
                String u = s.startsWith("/") ? "rel " + path(s.split("[?#]", 2)[0]) + queryKeys(queryOf(s)) : url(s);
                return "string:url{" + u + "}";
            }
        }
        if (ISO_DATE.matcher(s).matches()) {
            return "string:date";
        }
        return "string";
    }

    private static String queryOf(String s) {
        int q = s.indexOf('?');
        if (q < 0) {
            return "";
        }
        int h = s.indexOf('#', q);
        return s.substring(q + 1, h < 0 ? s.length() : h);
    }

    // ---- helpers ----

    private static String decode(String raw) {
        try {
            return java.net.URLDecoder.decode(raw, java.nio.charset.StandardCharsets.UTF_8);
        } catch (RuntimeException e) {
            return "?";
        }
    }

    private static int digits(String s) {
        int n = 0;
        for (int i = 0; i < s.length(); i++) {
            if (Character.isDigit(s.charAt(i))) {
                n++;
            }
        }
        return n;
    }

    private static int digitRun(String s) {
        int best = 0;
        int cur = 0;
        for (int i = 0; i < s.length(); i++) {
            cur = Character.isDigit(s.charAt(i)) ? cur + 1 : 0;
            best = Math.max(best, cur);
        }
        return best;
    }

    private static boolean isAllUpper(String s) {
        boolean letter = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (Character.isLowerCase(c)) {
                return false;
            }
            letter |= Character.isUpperCase(c);
        }
        return letter && s.length() >= 3;
    }

    private static boolean isAllUpperOrDigit(String s) {
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (!(Character.isUpperCase(c) || Character.isDigit(c) || c == '_')) {
                return false;
            }
        }
        return true;
    }

    /** Hex-only or very long mixed-case runs without word shape look like hashes or tokens. */
    private static boolean looksRandom(String s) {
        if (s.length() >= 16 && s.matches("[0-9a-fA-F]+")) {
            return true;
        }
        if (s.length() >= 24 && s.replaceAll("[_-]", "").matches("[A-Za-z0-9]+") && !s.contains("_") && !s.contains("-")) {
            // camelCase words this long are rare; treat as opaque
            return true;
        }
        return false;
    }
}
