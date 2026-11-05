package cevoc.adapter.out.ocr;

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Random;
import javax.imageio.ImageIO;

/**
 * Draws FICTITIOUS evidence images for tests: a dark photo-like area (noise over a gradient) under a black strip carrying
 * bold white sans-serif banner lines. All values are made up (camera code 7109, speed 70, time since red 0.4).
 */
public final class FictitiousBanners {

    private FictitiousBanners() {}

    /** The five lines of a made-up banner, in the order of the real layout. */
    public static List<String> lines(String speed, String timeSinceRed) {
        return List.of(
                "Camera Code: 7109 Direction: North Operator: Sample Roads",
                "Location: Sample Road, Sampletown",
                "Incident Number: 6 Lane: 2 Offence: Red light",
                (speed == null ? "" : "Speed Limit: " + speed + " km/h ")
                        + (timeSinceRed == null ? "" : "Time since red: " + timeSinceRed + " s ")
                        + "Yellow light duration: 4.0 s",
                "Date: 15/01/2026 Time: 11:12:13");
    }

    public static BufferedImage image(int width, int height, List<String> lines) {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        try {
            int stripHeight = Math.round(width * 0.085f);
            Random rnd = new Random(7);
            for (int y = stripHeight; y < height; y++) {
                int base = 60 + (int) (90.0 * y / height);
                for (int x = 0; x < width; x++) {
                    int v = Math.max(0, Math.min(255, base + rnd.nextInt(41) - 20));
                    img.setRGB(x, y, new Color(v, v, Math.min(255, v + 8)).getRGB());
                }
            }
            g.setColor(Color.BLACK);
            g.fillRect(0, 0, width, stripHeight);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            int lineHeight = stripHeight / (lines.size() + 1);
            g.setFont(new Font(Font.SANS_SERIF, Font.BOLD, Math.round(lineHeight * 0.78f)));
            g.setColor(Color.WHITE);
            int y = lineHeight;
            for (String line : lines) {
                g.drawString(line, lineHeight / 2, y);
                y += lineHeight;
            }
        } finally {
            g.dispose();
        }
        return img;
    }

    public static byte[] jpeg(BufferedImage img) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            ImageIO.write(img, "jpg", out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    public static byte[] jpeg(int width, int height, List<String> lines) {
        return jpeg(image(width, height, lines));
    }
}
