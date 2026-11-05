package cevoc.adapter.out.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

/** Offline: every bundle here is a tiny fictitious archive built inside the test. Nothing is downloaded. */
class DemoBundleTest {

    static final byte[] IMAGE = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);
    static final byte[] VIDEO = new byte[1_200_000]; // larger than the in-memory threshold: read lazily
    static final String BANNERS = "{\"media/a.svg\":[\"Camera Code: 7109\",\"Direction: Northbound\"]}";

    static String sha(byte[] b) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    static String entry(String path, String kind, String type, byte[] data, String licence) {
        return "{\"path\":\"" + path + "\",\"kind\":\"" + kind + "\",\"contentType\":\"" + type + "\",\"width\":960,\"height\":540,"
                + "\"size\":" + data.length + ",\"sha256\":\"" + sha(data) + "\",\"licence\":\"" + licence
                + "\",\"licenceUrl\":\"https://example.test/licence\",\"author\":\"Test Author\",\"credit\":\"Test Credit\"}";
    }

    /** A valid fictitious bundle; callers may replace the manifest or add files. */
    static byte[] zip(String version, String licence, Map<String, byte[]> extra) throws IOException {
        Map<String, byte[]> files = new LinkedHashMap<>();
        files.put("media/a.svg", IMAGE);
        files.put("media/b.mp4", VIDEO);
        files.put("text/banners.json", BANNERS.getBytes(StandardCharsets.UTF_8));
        String manifest = "{\"bundleVersion\":\"" + version + "\",\"files\":["
                + entry("media/a.svg", "image", "image/svg+xml", IMAGE, licence) + ","
                + entry("media/b.mp4", "video", "video/mp4", VIDEO, licence) + ","
                + entry("text/banners.json", "text", "application/json", BANNERS.getBytes(StandardCharsets.UTF_8), licence) + "]}";
        Map<String, byte[]> all = new LinkedHashMap<>();
        all.put("bundle.json", manifest.getBytes(StandardCharsets.UTF_8));
        all.putAll(files);
        all.putAll(extra);
        return pack(all);
    }

    static byte[] pack(Map<String, byte[]> all) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream z = new ZipOutputStream(out)) {
            for (Map.Entry<String, byte[]> e : all.entrySet()) {
                z.putNextEntry(new ZipEntry(e.getKey()));
                z.write(e.getValue());
                z.closeEntry();
            }
        }
        return out.toByteArray();
    }

    static byte[] valid() throws IOException {
        return zip("7", "Test Licence", Map.of());
    }

    @Test
    void aValidBundleOpensAndKeepsTheTwoPayloadsApart() throws Exception {
        byte[] zip = valid();
        DemoBundle b = DemoBundle.open(zip, sha(zip), "7");
        assertThat(b.version()).isEqualTo("7");
        assertThat(b.media("image")).extracting(DemoBundle.Entry::path).containsExactly("media/a.svg");
        assertThat(b.media("video")).extracting(DemoBundle.Entry::path).containsExactly("media/b.mp4");
        assertThat(b.entries()).extracting(DemoBundle.Entry::path).contains("text/banners.json");
        assertThat(b.banner("media/a.svg")).containsExactly("Camera Code: 7109", "Direction: Northbound");
        assertThat(b.banner("media/none.svg")).isEmpty();
        assertThat(b.read("media/a.svg")).contains(IMAGE);
        assertThat(b.read("media/b.mp4")).hasValueSatisfying(v -> assertThat(v).hasSize(VIDEO.length));
        assertThat(b.read("media/missing.svg")).isEmpty();
    }

    @Test
    void aWrongChecksumIsRefused() throws Exception {
        assertThatThrownBy(() -> DemoBundle.open(valid(), sha("other".getBytes(StandardCharsets.UTF_8)), "7"))
                .isInstanceOf(DemoBundleException.class).hasMessageContaining("checksum");
    }

    @Test
    void aWrongVersionIsRefused() throws Exception {
        byte[] zip = valid();
        assertThatThrownBy(() -> DemoBundle.open(zip, sha(zip), "8")).isInstanceOf(DemoBundleException.class).hasMessageContaining("version");
    }

    @Test
    void missingExpectedValuesAreRefused() throws Exception {
        byte[] zip = valid();
        assertThatThrownBy(() -> DemoBundle.open(zip, "", "7")).isInstanceOf(DemoBundleException.class);
        assertThatThrownBy(() -> DemoBundle.open(zip, sha(zip), null)).isInstanceOf(DemoBundleException.class);
    }

    @Test
    void aFileWithoutALicenceIsRefused() throws Exception {
        byte[] zip = zip("7", "", Map.of());
        assertThatThrownBy(() -> DemoBundle.open(zip, sha(zip), "7")).isInstanceOf(DemoBundleException.class).hasMessageContaining("licence");
    }

    @Test
    void aFileThatDoesNotMatchItsRecordedChecksumIsRefused() throws Exception {
        Map<String, byte[]> all = new LinkedHashMap<>();
        String manifest = "{\"bundleVersion\":\"7\",\"files\":[" + entry("media/a.svg", "image", "image/svg+xml", IMAGE, "L") + "]}";
        all.put("bundle.json", manifest.getBytes(StandardCharsets.UTF_8));
        all.put("media/a.svg", "<svg>tampered</svg>".getBytes(StandardCharsets.UTF_8));
        byte[] zip = pack(all);
        assertThatThrownBy(() -> DemoBundle.open(zip, sha(zip), "7")).isInstanceOf(DemoBundleException.class).hasMessageContaining("checksum");
    }

    @Test
    void anUnlistedFileIsRefused() throws Exception {
        byte[] zip = zip("7", "L", Map.of("media/extra.svg", IMAGE));
        assertThatThrownBy(() -> DemoBundle.open(zip, sha(zip), "7")).isInstanceOf(DemoBundleException.class).hasMessageContaining("not listed");
    }

    @Test
    void anUnsafeFileNameIsRefused() throws Exception {
        byte[] zip = zip("7", "L", Map.of("../evil.svg", IMAGE));
        assertThatThrownBy(() -> DemoBundle.open(zip, sha(zip), "7")).isInstanceOf(DemoBundleException.class).hasMessageContaining("unsafe");
    }

    @Test
    void garbageIsNotAnArchive() {
        byte[] junk = "not a zip".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> DemoBundle.open(junk, sha(junk), "7")).isInstanceOf(DemoBundleException.class);
    }

    @Test
    void theMediaSourceServesTheBundleImagesAndVideoUnderDemoKeys() throws Exception {
        byte[] zip = valid();
        BundleMediaSource source = new BundleMediaSource(DemoBundle.open(zip, sha(zip), "7"));
        DemoScenario s = new DemoCaseFactory(source).scenario("1000000001").orElseThrow();
        DemoMediaSet set = source.mediaFor(s);
        assertThat(set.items()).extracting(DemoMediaSet.Item::key)
                .containsExactly("demo/1000000001/image-1.svg", "demo/1000000001/image-2.svg", "demo/1000000001/image-3.svg", "demo/1000000001/video-1.mp4");
        assertThat(source.read("1000000001", "image-2.svg")).hasValueSatisfying(b -> {
            assertThat(b.contentType()).isEqualTo("image/svg+xml");
            assertThat(b.data()).isEqualTo(IMAGE);
        });
        assertThat(source.read("1000000001", "video-1.mp4")).hasValueSatisfying(b -> assertThat(b.data()).hasSize(VIDEO.length));
        assertThat(source.read("1000000001", "image-1.png")).isEmpty();
        assertThat(source.read("9999999999", "image-1.svg")).isEmpty();
        assertThat(source.read("1000000001", "../x")).isEmpty();
        assertThat(source.read("0000000001", "image-1.svg")).isPresent();
    }
}
