package au.gov.nsw.transport.cevoc.adapter.out.scraper.live;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/** Runs only with -Plive-browser. Fictitious payloads only; no browser, no network. */
class NetworkMapRedactionTest {

    private static final String JWT = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ0ZXN0In0.c2lnbmF0dXJl";
    private static final List<String> SECRETS = List.of("9000000004", "TST123", "tst123", JWT, "Jane", "Citizen",
            "15/01/2026", "2026-01-15", "7109", "s3cr3tT0kenValue", "abcdef0123456789abcdef");

    private static void assertClean(String out) {
        for (String s : SECRETS) {
            assertThat(out).as("must not contain %s", s).doesNotContain(s);
        }
    }

    @Test
    void idLikePathSegmentsBecomePlaceholders() {
        assertThat(NetworkMapRedaction.path("/v1/notices/9000000004/images/12"))
                .isEqualTo("/v1/notices/{n}/images/{n}");
        assertThat(NetworkMapRedaction.path("/api/items/123e4567-e89b-12d3-a456-426614174000/view"))
                .isEqualTo("/api/items/{uuid}/view");
        assertThat(NetworkMapRedaction.path("/api/plate/TST123/x")).isEqualTo("/api/plate/{id:alnum6}/x");
        assertThat(NetworkMapRedaction.path("/api/notice-9000000004")).isEqualTo("/api/{id:other17}");
        assertThat(NetworkMapRedaction.path("/static/main.4f3a2b1c.js")).isEqualTo("/static/{id:other16}");
        assertThat(NetworkMapRedaction.path("/static/main.js")).isEqualTo("/static/main.js");
        assertThat(NetworkMapRedaction.path("/api/getImages;jsessionid=abc")).isEqualTo("/api/{id:other24}");
        assertThat(NetworkMapRedaction.path("/api/ABCDEF")).isEqualTo("/api/{id:upper6}");
        assertThat(NetworkMapRedaction.path("/")).isEqualTo("/");
    }

    @Test
    void jwtInThePathIsNeverEmitted() {
        String out = NetworkMapRedaction.path("/auth/" + JWT + "/refresh");
        assertThat(out).isEqualTo("/auth/{id:other" + JWT.length() + "}/refresh");
        assertClean(out);
        assertClean(NetworkMapRedaction.url("https://api.example.invalid/x/" + JWT + "?token=" + JWT));
    }

    @Test
    void queryIsReducedToSortedKeyNamesOnly() {
        assertThat(NetworkMapRedaction.queryKeys("noticeId=9000000004&plate=TST123&b=2&a=1"))
                .isEqualTo("?a&b&noticeId&plate");
        assertThat(NetworkMapRedaction.queryKeys("9000000004=x&" + JWT + "=y&ok=1")).isEqualTo("?%3F&ok".replace("%3F", "?"));
        assertThat(NetworkMapRedaction.queryKeys("")).isEmpty();
        assertThat(NetworkMapRedaction.queryKeys(null)).isEmpty();
        assertClean(NetworkMapRedaction.queryKeys("a=9000000004&TST123=1&x=" + JWT));
    }

    @Test
    void keysMustPassTheWhitelistAndNotLookLikeIdentifiers() {
        assertThat(NetworkMapRedaction.key("penaltyAmount")).isEqualTo("penaltyAmount");
        assertThat(NetworkMapRedaction.key("vehicle_number")).isEqualTo("vehicle_number");
        assertThat(NetworkMapRedaction.key("9000000004")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("N9000000004")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("TST123")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("15/01/2026")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("Jane Citizen")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("a.b")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key(JWT)).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("abcdef0123456789abcdef")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("x".repeat(41))).isEqualTo("?");
        assertThat(NetworkMapRedaction.key("")).isEqualTo("?");
        assertThat(NetworkMapRedaction.key(null)).isEqualTo("?");
    }

    @Test
    void jsonShapeHasTypesAndLengthsButNoValues() {
        String body = "{\"notice\":{\"number\":\"9000000004\",\"plate\":\"TST123\",\"amount\":123.45,\"paid\":false,"
                + "\"when\":\"2026-01-15T10:00:00\",\"note\":null,\"name\":\"Jane Citizen\"},"
                + "\"images\":[{\"ref\":\"7109\",\"url\":\"https://img.example.invalid/a/9000000004/full?sig=s3cr3tT0kenValue&se=1\"},"
                + "{\"ref\":\"7109\",\"url\":\"https://img.example.invalid/a/9000000004/full?sig=s3cr3tT0kenValue&se=1\"}],"
                + "\"token\":\"" + JWT + "\",\"9000000004\":\"x\",\"TST123\":1}";
        String shape = NetworkMapRedaction.jsonShape(body);
        assertThat(shape).contains("notice:{number:string,plate:string,amount:number,paid:bool,when:string:date,note:null,name:string}");
        assertThat(shape).contains("images:array<2>({ref:string,url:string:url{img.example.invalid /a/{n}/full?se&sig}})");
        assertThat(shape).contains("token:string:jwt");
        assertThat(shape).contains("?:string").contains("?:number");
        assertClean(shape);
    }

    @Test
    void jsonShapeHandlesOddInput() {
        assertThat(NetworkMapRedaction.jsonShape("not json 9000000004")).isEqualTo("not-json");
        assertThat(NetworkMapRedaction.jsonShape("")).isEqualTo("empty");
        assertThat(NetworkMapRedaction.jsonShape("[]")).isEqualTo("array<0>");
        assertThat(NetworkMapRedaction.jsonShape("\"9000000004\"")).isEqualTo("string");
        assertThat(NetworkMapRedaction.jsonShape("42")).isEqualTo("number");
        StringBuilder big = new StringBuilder("{");
        for (int i = 0; i < 40; i++) {
            big.append(i == 0 ? "" : ",").append("\"k").append(i).append("\":1");
        }
        assertThat(NetworkMapRedaction.jsonShape(big.append('}').toString())).isEqualTo("object<40 keys>");
        String deep = "{\"a\":{\"b\":{\"c\":{\"d\":{\"e\":{\"f\":{\"g\":{\"h\":1}}}}}}}}";
        assertThat(NetworkMapRedaction.jsonShape(deep)).doesNotContain("h:");
    }

    @Test
    void formBodiesKeepKeyNamesOnly() {
        String out = NetworkMapRedaction.formShape("pnn=9000000004&vehicleNumber=TST123&dateOfOffence=15%2F01%2F2026");
        assertThat(out).isEqualTo("form{dateOfOffence,pnn,vehicleNumber}");
        assertClean(out);
    }

    @Test
    void headersAndContentTypesAreNamesOnly() {
        assertThat(NetworkMapRedaction.headerName("Authorization")).isEqualTo("authorization");
        assertThat(NetworkMapRedaction.headerName("X-Custom-9000000004")).isEqualTo("?");
        assertThat(NetworkMapRedaction.headerName("bad header")).isEqualTo("?");
        assertThat(NetworkMapRedaction.contentType("application/json; charset=utf-8")).isEqualTo("application/json");
        assertThat(NetworkMapRedaction.contentType("weird value 9000000004")).isEqualTo("?");
        assertThat(NetworkMapRedaction.contentType(null)).isEqualTo("none");
        assertThat(NetworkMapRedaction.authScheme("Bearer " + JWT)).isEqualTo("bearer");
        assertThat(NetworkMapRedaction.authScheme("Token s3cr3tT0kenValue")).isEqualTo("other");
        assertThat(NetworkMapRedaction.authScheme(null)).isEqualTo("none");
    }

    @Test
    void hostsKeepPlainLabelsOnly() {
        assertThat(NetworkMapRedaction.host("api.example.invalid")).isEqualTo("api.example.invalid");
        assertThat(NetworkMapRedaction.host("t9000000004.example.invalid")).isEqualTo("?.example.invalid");
        assertThat(NetworkMapRedaction.host("bad host!.x")).isEqualTo("?.x");
        assertThat(NetworkMapRedaction.host(null)).isEqualTo("?");
    }

    @Test
    void sizesAreBucketedAndPixelSizeReadFromAHeader() throws Exception {
        assertThat(NetworkMapRedaction.sizeBucket(0)).isEqualTo("0");
        assertThat(NetworkMapRedaction.sizeBucket(999)).isEqualTo("<1KB");
        assertThat(NetworkMapRedaction.sizeBucket(300_000)).isEqualTo("<500KB");
        assertThat(NetworkMapRedaction.sizeBucket(9_000_000)).isEqualTo(">=5MB");
        var img = new java.awt.image.BufferedImage(40, 30, java.awt.image.BufferedImage.TYPE_INT_RGB);
        var bos = new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(img, "png", bos);
        assertThat(NetworkMapRedaction.pixelSize(bos.toByteArray())).isEqualTo("40x30");
        assertThat(NetworkMapRedaction.pixelSize(new byte[100])).isEqualTo("unknown");
        assertThat(NetworkMapRedaction.pixelSize(null)).isEqualTo("unknown");
    }

    @Test
    void jwtDetectionIsABooleanOnly() {
        assertThat(NetworkMapRedaction.hasJwtValue("{\"a\":{\"t\":\"" + JWT + "\"}}")).isTrue();
        assertThat(NetworkMapRedaction.hasJwtValue("{\"a\":\"plain\"}")).isFalse();
        assertThat(NetworkMapRedaction.hasJwtValue("nope")).isFalse();
    }
}
