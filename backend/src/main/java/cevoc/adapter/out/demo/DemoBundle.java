package cevoc.adapter.out.demo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * A verified demo content bundle: one zip with {@code bundle.json} (bundle version and, for every file, size, SHA-256,
 * licence, licence URL, author, credit), the media payload under {@code media/} and the text payload under {@code text/}.
 * {@link #open} either returns a fully verified bundle or throws {@link DemoBundleException}: there is no half-loaded set.
 * Checks: archive SHA-256 equals the configured one, bundle version equals the configured one, every file has a recorded
 * licence, author, credit, size and checksum that match, no unlisted or unsafe file name. Small files are kept in memory;
 * large ones (video) are read from the archive only when a case asks for them.
 */
public final class DemoBundle {

    static final long MAX_ENTRY = 40L * 1024 * 1024;
    static final long MAX_TOTAL = 100L * 1024 * 1024;
    static final int MAX_ENTRIES = 200;
    private static final int KEEP_IN_MEMORY = 1024 * 1024;
    private static final ObjectMapper JSON = new ObjectMapper();

    public record Entry(String path, String kind, String contentType, int width, int height, long size, String sha256,
                        String licence, String licenceUrl, String author, String credit) {}

    private final byte[] archive;
    private final String version;
    private final Map<String, Entry> entries;
    private final Map<String, byte[]> small;
    private final Map<String, List<String>> banners;

    private DemoBundle(byte[] archive, String version, Map<String, Entry> entries, Map<String, byte[]> small, Map<String, List<String>> banners) {
        this.archive = archive;
        this.version = version;
        this.entries = Collections.unmodifiableMap(entries);
        this.small = small;
        this.banners = banners;
    }

    public static DemoBundle open(byte[] archive, String expectedSha256, String expectedVersion) throws DemoBundleException {
        if (blank(expectedSha256) || blank(expectedVersion)) {
            throw new DemoBundleException("the expected bundle checksum and version must both be configured");
        }
        if (archive == null || !hex(sha256(archive)).equalsIgnoreCase(expectedSha256.trim())) {
            throw new DemoBundleException("the bundle checksum does not match the configured one");
        }
        Map<String, byte[]> raw = readAll(archive);
        byte[] manifestBytes = raw.remove("bundle.json");
        if (manifestBytes == null) {
            throw new DemoBundleException("the bundle has no bundle.json");
        }
        JsonNode root;
        try {
            root = JSON.readTree(manifestBytes);
        } catch (IOException e) {
            throw new DemoBundleException("bundle.json is not valid JSON");
        }
        String version = text(root, "bundleVersion");
        if (!expectedVersion.trim().equals(version)) {
            throw new DemoBundleException("the bundle version is not the configured one");
        }
        JsonNode files = root.get("files");
        if (files == null || !files.isArray() || files.isEmpty()) {
            throw new DemoBundleException("the bundle lists no files");
        }
        Map<String, Entry> entries = new LinkedHashMap<>();
        Map<String, byte[]> small = new LinkedHashMap<>();
        for (JsonNode f : files) {
            Entry e = new Entry(text(f, "path"), text(f, "kind"), text(f, "contentType"), f.path("width").asInt(0), f.path("height").asInt(0),
                    f.path("size").asLong(-1), text(f, "sha256"), text(f, "licence"), text(f, "licenceUrl"), text(f, "author"), text(f, "credit"));
            if (blank(e.path()) || blank(e.kind()) || blank(e.contentType())) {
                throw new DemoBundleException("a bundle file entry is incomplete");
            }
            if (blank(e.licence()) || blank(e.licenceUrl()) || blank(e.author()) || blank(e.credit())) {
                throw new DemoBundleException("a bundle file has no recorded licence, author or credit");
            }
            byte[] data = raw.remove(e.path());
            if (data == null || entries.containsKey(e.path())) {
                throw new DemoBundleException("a listed bundle file is missing or listed twice");
            }
            if (data.length != e.size() || !hex(sha256(data)).equalsIgnoreCase(e.sha256())) {
                throw new DemoBundleException("a bundle file does not match its recorded size or checksum");
            }
            entries.put(e.path(), e);
            if (data.length <= KEEP_IN_MEMORY) {
                small.put(e.path(), data);
            }
        }
        if (!raw.isEmpty()) {
            throw new DemoBundleException("the bundle holds a file that is not listed");
        }
        Map<String, List<String>> banners = new LinkedHashMap<>();
        byte[] bannerBytes = small.get("text/banners.json");
        if (bannerBytes != null) {
            try {
                Map<String, List<String>> parsed = JSON.readValue(bannerBytes, new TypeReference<Map<String, List<String>>>() {});
                parsed.forEach((k, v) -> banners.put(k, List.copyOf(v)));
            } catch (IOException e) {
                throw new DemoBundleException("text/banners.json is not valid");
            }
        }
        return new DemoBundle(archive, version, entries, small, banners);
    }

    public String version() {
        return version;
    }

    /** Every file the content manifest lists, in manifest order. */
    public List<Entry> entries() {
        return new ArrayList<>(entries.values());
    }

    /** The media payload of one kind ("image" or "video"), sorted by path. */
    public List<Entry> media(String kind) {
        return entries.values().stream().filter(e -> e.path().startsWith("media/") && e.kind().equals(kind))
                .sorted(java.util.Comparator.comparing(Entry::path)).toList();
    }

    /** The banner lines recorded as separate text for a media file (empty when none). */
    public List<String> banner(String mediaPath) {
        return banners.getOrDefault(mediaPath, List.of());
    }

    /** The bytes of one listed file; a large file is read from the archive now, not earlier. */
    public Optional<byte[]> read(String path) {
        if (!entries.containsKey(path)) {
            return Optional.empty();
        }
        byte[] kept = small.get(path);
        if (kept != null) {
            return Optional.of(kept);
        }
        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(archive), StandardCharsets.UTF_8)) {
            ZipEntry ze;
            while ((ze = zin.getNextEntry()) != null) {
                if (ze.getName().equals(path)) {
                    return Optional.of(zin.readNBytes((int) MAX_ENTRY));
                }
            }
        } catch (IOException e) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    private static Map<String, byte[]> readAll(byte[] archive) throws DemoBundleException {
        Map<String, byte[]> out = new LinkedHashMap<>();
        long total = 0;
        try (ZipInputStream zin = new ZipInputStream(new ByteArrayInputStream(archive), StandardCharsets.UTF_8)) {
            ZipEntry ze;
            while ((ze = zin.getNextEntry()) != null) {
                String name = ze.getName();
                if (ze.isDirectory()) {
                    continue;
                }
                if (name.startsWith("/") || name.contains("..") || name.contains("\\") || name.length() > 120 || out.containsKey(name)) {
                    throw new DemoBundleException("the bundle holds an unsafe or repeated file name");
                }
                if (out.size() >= MAX_ENTRIES) {
                    throw new DemoBundleException("the bundle holds too many files");
                }
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[16384];
                int n;
                while ((n = zin.read(chunk)) > 0) {
                    buf.write(chunk, 0, n);
                    total += n;
                    if (buf.size() > MAX_ENTRY || total > MAX_TOTAL) {
                        throw new DemoBundleException("the bundle is larger than allowed");
                    }
                }
                out.put(name, buf.toByteArray());
            }
        } catch (IOException e) {
            throw new DemoBundleException("the bundle is not a readable archive");
        }
        return out;
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static byte[] sha256(byte[] data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hex(byte[] b) {
        return HexFormat.of().formatHex(b);
    }
}
