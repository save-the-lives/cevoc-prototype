package cevoc.adapter.out.ocr;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Row scanning and preparation on fictitious images; needs no OCR engine. */
class BannerStripTest {

    @Test
    void findsTheBlackBandByScanningNotByAFixedHeight() {
        for (int[] size : new int[][] {{3400, 2706}, {1700, 1350}, {1000, 800}, {1200, 1500}}) {
            BufferedImage img = FictitiousBanners.image(size[0], size[1], FictitiousBanners.lines("70", "0.4"));
            int expected = Math.round(size[0] * 0.085f);
            int region = Math.min(size[1], Math.max(size[1] * 3 / 10, Math.min(size[1], 300)));
            int found = BannerStrip.findHeight(img.getSubimage(0, 0, size[0], region), size[1]);
            assertThat(found).as("%dx%d", size[0], size[1]).isBetween(expected - 3, expected + 3);
        }
    }

    @Test
    void fallsBackToAShareOfTheHeightWhenThereIsNoBand() {
        BufferedImage img = FictitiousBanners.image(1000, 800, List.of());
        // paint over the black strip with photo-like noise
        java.util.Random rnd = new java.util.Random(3);
        for (int y = 0; y < 85; y++) {
            for (int x = 0; x < 1000; x++) {
                int v = 90 + rnd.nextInt(60);
                img.setRGB(x, y, (v << 16) | (v << 8) | v);
            }
        }
        int found = BannerStrip.findHeight(img.getSubimage(0, 0, 1000, 300), 800);
        assertThat(found).isEqualTo(Math.round(800 * (float) BannerStrip.FALLBACK_SHARE));
    }

    @Test
    void anAllBlackImageIsNotTakenForABand() {
        BufferedImage black = new BufferedImage(600, 400, BufferedImage.TYPE_INT_RGB);
        int found = BannerStrip.findHeight(black.getSubimage(0, 0, 600, 200), 400);
        assertThat(found).isEqualTo(60);
    }

    @Test
    void preparedStripIsDarkTextOnWhiteWithABorder() {
        BufferedImage img = FictitiousBanners.image(1000, 800, FictitiousBanners.lines("70", "0.4"));
        BufferedImage ready = BannerStrip.prepare(img.getSubimage(0, 0, 1000, 240), 85);
        long white = 0;
        long dark = 0;
        for (int y = 0; y < ready.getHeight(); y++) {
            for (int x = 0; x < ready.getWidth(); x++) {
                int v = ready.getRaster().getSample(x, y, 0);
                if (v > 200) {
                    white++;
                } else if (v < 60) {
                    dark++;
                }
            }
        }
        assertThat(white).isGreaterThan(dark * 3); // mostly white page
        assertThat(dark).isGreaterThan(0); // with text
        assertThat(ready.getRaster().getSample(0, 0, 0)).isEqualTo(255); // white border
    }
}
