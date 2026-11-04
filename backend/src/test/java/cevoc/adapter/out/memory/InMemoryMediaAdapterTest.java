package cevoc.adapter.out.memory;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cevoc.domain.ImageVariant;
import cevoc.domain.MediaContent;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

/** Fictitious plain-colour images only. */
class InMemoryMediaAdapterTest {

    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-01-01T00:00:00Z");

        @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    static byte[] jpeg(int w, int h) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "jpg", out);
        return out.toByteArray();
    }

    private static void store(InMemoryMediaAdapter m, String key, byte[] data) {
        m.store(key, "image/jpeg", new ByteArrayInputStream(data), data.length);
    }

    private static String token(String link) {
        String path = link.contains("?") ? link.substring(0, link.indexOf('?')) : link;
        return path.substring(path.lastIndexOf('/') + 1);
    }

    @Test
    void theOriginalIsServedUntouchedAndSmallerCopiesAreMadeOnDemand() throws Exception {
        MutableClock clock = new MutableClock();
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("", Duration.ofMinutes(20), 64L << 20, clock);
        byte[] original = jpeg(3400, 2706);
        store(m, "scraped/abc/image-1.jpg", original);

        var full = m.linkFor("scraped/abc/image-1.jpg", Duration.ofMinutes(15));
        var thumb = m.linkFor("scraped/abc/image-1.jpg", ImageVariant.THUMBNAIL, Duration.ofMinutes(15)).orElseThrow();
        var medium = m.linkFor("scraped/abc/image-1.jpg", ImageVariant.MEDIUM, Duration.ofMinutes(15)).orElseThrow();
        assertThat(full.url()).startsWith("/api/media/").doesNotContain("?");
        assertThat(thumb.url()).endsWith("?s=thumb");
        assertThat(medium.url()).endsWith("?s=medium");
        assertThat(full.url()).doesNotContain("image-1").doesNotContain("abc");

        MediaContent o = m.read(token(full.url()), null).orElseThrow();
        assertThat(o.data()).isEqualTo(original);
        assertThat(o.contentType()).isEqualTo("image/jpeg");

        BufferedImage t = ImageIO.read(new ByteArrayInputStream(m.read(token(thumb.url()), ImageVariant.THUMBNAIL).orElseThrow().data()));
        BufferedImage md = ImageIO.read(new ByteArrayInputStream(m.read(token(medium.url()), ImageVariant.MEDIUM).orElseThrow().data()));
        assertThat(t.getWidth()).isEqualTo(InMemoryMediaAdapter.THUMBNAIL_WIDTH);
        assertThat(md.getWidth()).isEqualTo(InMemoryMediaAdapter.MEDIUM_WIDTH);
        // aspect ratio kept
        assertThat((double) t.getHeight() / t.getWidth()).isCloseTo(2706.0 / 3400.0, org.assertj.core.data.Offset.offset(0.01));
    }

    @Test
    void anImageSmallerThanTheTargetIsServedAsIs() throws Exception {
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("", Duration.ofMinutes(20), 64L << 20, new MutableClock());
        byte[] tiny = jpeg(113, 90);
        store(m, "k", tiny);
        var thumb = m.linkFor("k", ImageVariant.THUMBNAIL, Duration.ofMinutes(5)).orElseThrow();
        assertThat(m.read(token(thumb.url()), ImageVariant.THUMBNAIL).orElseThrow().data()).isEqualTo(tiny);
    }

    @Test
    void aBaseUrlMakesLinksAbsolute() throws Exception {
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("https://api.example.test/", Duration.ofMinutes(20), 64L << 20, new MutableClock());
        store(m, "k", jpeg(10, 10));
        assertThat(m.linkFor("k", Duration.ofMinutes(5)).url()).startsWith("https://api.example.test/api/media/");
    }

    @Test
    void objectsAndLinksExpire() throws Exception {
        MutableClock clock = new MutableClock();
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("", Duration.ofMinutes(20), 64L << 20, clock);
        store(m, "k", jpeg(10, 10));
        String t = token(m.linkFor("k", Duration.ofMinutes(5)).url());
        clock.now = clock.now.plus(Duration.ofMinutes(6));
        assertThat(m.read(t, null)).isEmpty(); // link expired
        String t2 = token(m.linkFor("k", Duration.ofMinutes(60)).url());
        clock.now = clock.now.plus(Duration.ofMinutes(15));
        assertThat(m.read(t2, null)).isEmpty(); // object retention (20 minutes in total) is the upper bound
        assertThat(m.exists("k")).isFalse();
    }

    @Test
    void readingKeepsAPageAliveButNeverBeyondTheTotalCap() throws Exception {
        MutableClock clock = new MutableClock();
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("", Duration.ofMinutes(20), 64L << 20, clock);
        store(m, "k", jpeg(10, 10));
        String t = token(m.linkFor("k", Duration.ofMinutes(15)).url());
        for (int i = 0; i < 5; i++) { // a reader who comes back every 10 minutes: 10, 20, 30, 40, 50
            clock.now = clock.now.plus(Duration.ofMinutes(10));
            assertThat(m.read(t, null)).isPresent();
        }
        // 70 minutes after storing: past the 60 minute cap, so it is gone however recently it was read
        clock.now = clock.now.plus(Duration.ofMinutes(20));
        assertThat(m.read(t, null)).isEmpty();
    }

    @Test
    void unknownTokensAndNonImagesGiveNothing() {
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("", Duration.ofMinutes(20), 1024, new MutableClock());
        assertThat(m.read("does-not-exist-0000", null)).isEmpty();
        m.store("v", "video/mp4", new ByteArrayInputStream(new byte[] {1, 2}), 2);
        assertThat(m.linkFor("v", ImageVariant.THUMBNAIL, Duration.ofMinutes(5))).isEmpty();
    }

    @Test
    void theTotalSizeIsBoundedByDroppingTheOldestFirst() {
        InMemoryMediaAdapter m = new InMemoryMediaAdapter("", Duration.ofMinutes(20), 10, new MutableClock());
        m.store("a", "image/png", new ByteArrayInputStream(new byte[6]), 6);
        m.store("b", "image/png", new ByteArrayInputStream(new byte[6]), 6);
        assertThat(m.exists("a")).isFalse();
        assertThat(m.exists("b")).isTrue();
        assertThatThrownBy(() -> m.store("c", "image/png", new ByteArrayInputStream(new byte[11]), 11))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void toStringShowsNoContent() {
        assertThat(new InMemoryMediaAdapter("", Duration.ofMinutes(1), 10, new MutableClock()).toString()).isEqualTo("InMemoryMediaAdapter");
        assertThat(new MediaContent("image/png", new byte[] {9}).toString()).isEqualTo("MediaContent");
    }
}
