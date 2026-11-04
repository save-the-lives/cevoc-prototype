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
    private static final Set<String> ENUM_VALUES = Set.of("thumb", "thumbnail", "small", "medium", "large", "full",
            "original", "orig", "preview", "high", "low", "xl", "lg", "md", "sm", "true", "false");
    private static final byte[] SALT = new byte[16];

    static {
        new java.security.SecureRandom().nextBytes(SALT);
    }

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
                return idTag(s);
            }
        }
        if (WORD_SEGMENT.matcher(stem).matches() && !isAllUpper(stem) && !looksRandom(stem)) {
            return stem + ext;
        }
        return idTag(s);
    }

    /**
     * 4 hex chars of SHA-256(per-process random salt + value): equal segments within one run show the same tag, so
     * "same id in all calls" is visible; the salt is never emitted and changes every start, so nothing can be
     * looked up or compared across runs.
     */
    static String salted(String s) {
        try {
            var md = java.security.MessageDigest.getInstance("SHA-256");
            md.update(SALT);
            byte[] h = md.digest(s.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return String.format("%02x%02x", h[0], h[1]);
        } catch (java.security.NoSuchAlgorithmException e) {
            return "0000";
        }
    }

    /**
     * "{id:mask#tag}": the character-class MASK of an identifier-like segment (A upper, a lower, 9 digit, - _ . kept,
     * anything else ?), or "long<n>" past 40 characters; plus the salted tag. Never the content.
     */
    static String idTag(String s) {
        String body;
        if (s.length() > 40) {
            body = "long" + Math.min(s.length(), 999);
        } else {
            StringBuilder m = new StringBuilder();
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                m.append(Character.isDigit(c) ? '9' : (c >= 'A' && c <= 'Z') ? 'A' : (c >= 'a' && c <= 'z') ? 'a'
                        : (c == '-' || c == '_' || c == '.') ? c : '?');
            }
            body = m.toString();
        }
        return "{id:" + body + "#" + salted(s) + "}";
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
            String k = key(eq < 0 ? pair : pair.substring(0, eq));
            // A value is shown only if it is one of a few fixed size/mode words, so "size=full" is visible but
            // no identifier, date or token ever is.
            String v = eq < 0 ? "" : decode(pair.substring(eq + 1)).toLowerCase(Locale.ROOT);
            keys.add(!"?".equals(k) && ENUM_VALUES.contains(v) ? k + "=" + v : k);
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

    /** Pixel size "WxH" read from a PNG or JPEG header, or "unknown". Dimensions only; no pixel data is kept. */
    public static String pixelSize(byte[] d) {
        if (d == null || d.length < 24) {
            return "unknown";
        }
        // PNG: signature, then IHDR with big-endian width and height at offsets 16 and 20.
        if ((d[0] & 0xFF) == 0x89 && d[1] == 'P' && d[2] == 'N' && d[3] == 'G') {
            return u32(d, 16) + "x" + u32(d, 20);
        }
        // JPEG: walk the segments to the first start-of-frame marker.
        if ((d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8) {
            int i = 2;
            while (i + 9 < d.length) {
                if ((d[i] & 0xFF) != 0xFF) {
                    i++;
                    continue;
                }
                int m = d[i + 1] & 0xFF;
                if (m == 0xFF) {
                    i++;
                    continue;
                }
                if (m >= 0xC0 && m <= 0xCF && m != 0xC4 && m != 0xC8 && m != 0xCC) {
                    int h = ((d[i + 5] & 0xFF) << 8) | (d[i + 6] & 0xFF);
                    int w = ((d[i + 7] & 0xFF) << 8) | (d[i + 8] & 0xFF);
                    return w + "x" + h;
                }
                if (m == 0xD8 || m == 0x01 || (m >= 0xD0 && m <= 0xD7)) {
                    i += 2;
                    continue;
                }
                i += 2 + (((d[i + 2] & 0xFF) << 8) | (d[i + 3] & 0xFF));
            }
        }
        return "unknown";
    }

    /**
     * Format diagnostics for an image body: its 4 magic bytes in hex and, for a JPEG, the first marker codes. These are
     * fixed file-format codes, not content. Used only when the pixel size could not be read.
     */
    public static String imageHint(byte[] d) {
        if (d == null || d.length < 4) {
            return "none";
        }
        StringBuilder sb = new StringBuilder("magic=");
        for (int i = 0; i < 4; i++) {
            sb.append(String.format("%02x", d[i] & 0xFF));
        }
        if ((d[0] & 0xFF) == 0xFF && (d[1] & 0xFF) == 0xD8) {
            sb.append(" markers=");
            int i = 2;
            int n = 0;
            while (i + 3 < d.length && n < 10) {
                if ((d[i] & 0xFF) != 0xFF) {
                    sb.append("!");
                    break;
                }
                int m = d[i + 1] & 0xFF;
                sb.append(String.format("%02x", m)).append(',');
                n++;
                i += (m == 0xD8 || m == 0x01 || (m >= 0xD0 && m <= 0xD7)) ? 2 : 2 + (((d[i + 2] & 0xFF) << 8) | (d[i + 3] & 0xFF));
            }
        }
        return sb.toString();
    }

    private static long u32(byte[] d, int o) {
        return ((long) (d[o] & 0xFF) << 24) | ((d[o + 1] & 0xFF) << 16) | ((d[o + 2] & 0xFF) << 8) | (d[o + 3] & 0xFF);
    }

    /** Byte size rounded to the nearest 10 KB, for images only (a size fingerprint of a public-format file). */
    public static String approxKb(long bytes) {
        return bytes < 0 ? "unknown" : (Math.round(bytes / 10_000.0) * 10) + "KB";
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
            return "array<" + n.size() + ">" + (distinct.isEmpty() ? "" : "(" + String.join("|", distinct) + ")");
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
