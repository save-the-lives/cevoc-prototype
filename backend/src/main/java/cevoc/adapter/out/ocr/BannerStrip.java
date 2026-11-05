package cevoc.adapter.out.ocr;

import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;

/**
 * Pure image handling for the banner: finds the black band at the top of the picture by scanning rows (no fixed pixel
 * count), then makes it ready for OCR (scaled, binarised, inverted so the text is dark on white). Works in memory only.
 */
final class BannerStrip {

    /** Never taller than this share of the examined region: beyond it the scan did not find a band. */
    private static final double MAX_BAND_SHARE = 0.95;
    /** Used when no band is found: this share of the full image height. */
    static final double FALLBACK_SHARE = 0.15;
    private static final int GAP_ROWS = 6;
    private static final int MIN_BAND = 16;
    /** Target height of one text line after scaling, in pixels (5 banner lines in the band). */
    private static final double TARGET_LINE_PX = 48.0;
    private static final int BORDER = 16;

    private BannerStrip() {}

    /**
     * Height in pixels of the dark band at the top of {@code region} (a gray or colour top part of the image), or the
     * fallback (15 percent of {@code fullHeight}, at least the minimum, at most the region) when no band is found.
     * A band row is mostly dark pixels with few mid-tones: white text and black background, but not a photograph.
     */
    static int findHeight(BufferedImage region, int fullHeight) {
        int w = region.getWidth();
        int h = region.getHeight();
        int step = Math.max(1, w / 900);
        int end = 0;
        int nonBand = 0;
        for (int y = 0; y < h; y++) {
            if (isBandRow(region, y, w, step)) {
                nonBand = 0;
                end = y + 1;
            } else if (++nonBand >= GAP_ROWS) {
                break;
            }
        }
        boolean found = end >= MIN_BAND && end <= h * MAX_BAND_SHARE;
        return found ? end : Math.min(h, Math.max(MIN_BAND, (int) Math.round(fullHeight * FALLBACK_SHARE)));
    }

    private static boolean isBandRow(BufferedImage img, int y, int w, int step) {
        int total = 0;
        int dark = 0;
        int mid = 0;
        for (int x = 0; x < w; x += step) {
            int rgb = img.getRGB(x, y);
            int lum = (((rgb >> 16) & 0xFF) * 299 + ((rgb >> 8) & 0xFF) * 587 + (rgb & 0xFF) * 114) / 1000;
            total++;
            if (lum < 50) {
                dark++;
            } else if (lum <= 170) {
                mid++;
            }
        }
        return dark * 100 >= total * 40 && mid * 100 <= total * 20;
    }

    /** The strip as black text on white: scaled so a line is about 48 px, thresholded, with a white border. */
    static BufferedImage prepare(BufferedImage region, int stripHeight) {
        int w = region.getWidth();
        double scale = Math.max(0.5, Math.min(3.0, TARGET_LINE_PX / (stripHeight / 5.0)));
        int nw = Math.max(1, (int) Math.round(w * scale));
        int nh = Math.max(1, (int) Math.round(stripHeight * scale));
        BufferedImage gray = new BufferedImage(nw, nh, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = gray.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.drawImage(region.getSubimage(0, 0, w, stripHeight), 0, 0, nw, nh, null);
        } finally {
            g.dispose();
        }
        BufferedImage out = new BufferedImage(nw + 2 * BORDER, nh + 2 * BORDER, BufferedImage.TYPE_BYTE_GRAY);
        int white = 0xFFFFFF;
        for (int y = 0; y < out.getHeight(); y++) {
            for (int x = 0; x < out.getWidth(); x++) {
                out.setRGB(x, y, white);
            }
        }
        int black = 0x000000;
        for (int y = 0; y < nh; y++) {
            for (int x = 0; x < nw; x++) {
                // bright (text) becomes dark; dark (background) becomes white
                if ((gray.getRaster().getSample(x, y, 0)) > 110) {
                    out.setRGB(x + BORDER, y + BORDER, black);
                }
            }
        }
        return out;
    }
}
