package cevoc.adapter.out.demo;

import cevoc.domain.EvidenceItem;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Generates simple fictitious sample images as SVG text (no fonts or graphics libraries needed, no files, no network).
 * Every image says in words that it is a sample, so it cannot be mistaken for evidence. Deterministic: the same case
 * and image number always give the same bytes. The sample video at {@code frontend/public/samples/video-1.mp4} is the
 * raw (unblurred) source. It is served through the backend's blur pipeline ({@link cevoc.application.port.out.BlurPort})
 * which blurs faces and non-offending plates at request time, keeping the offending plate (ABC123) visible. When blur
 * is not enabled ({@code CEVOC_BLUR_ENABLED=false}, the default), video returns a 503 (fail-closed, ADR 0017).
 */
public final class SampleMediaSource implements DemoMediaSource {

    static final int WIDTH = 960;
    static final int HEIGHT = 540;
    static final String VIDEO_KEY = "samples/video-1.mp4";
    private static final Pattern NAME = Pattern.compile("image-(\\d{1,2})\\.svg");

    @Override
    public DemoMediaSet mediaFor(DemoScenario s) {
        List<DemoMediaSet.Item> items = new ArrayList<>();
        for (int i = 1; i <= s.images(); i++) {
            items.add(new DemoMediaSet.Item(EvidenceItem.Kind.IMAGE, "Sample camera image " + i + " (fictitious)",
                    "demo/" + s.number() + "/image-" + i + ".svg", "image/svg+xml", WIDTH, HEIGHT));
        }
        if (s.video()) {
            items.add(new DemoMediaSet.Item(EvidenceItem.Kind.VIDEO, "Sample video (fictitious)", VIDEO_KEY, "video/mp4", 0, 0));
        }
        return new DemoMediaSet(items);
    }

    @Override
    public Optional<Bytes> read(String number, String name) {
        Matcher m = NAME.matcher(name == null ? "" : name);
        if (!m.matches() || DemoNumber.parse(number).filter(n -> n.program().built()).isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new Bytes("image/svg+xml", svg(number, Integer.parseInt(m.group(1))).getBytes(StandardCharsets.UTF_8)));
    }

    static String svg(String number, int index) {
        int seed = Integer.parseInt(number.substring(6)) * 7 + index * 13;
        int carX = 140 + (seed * 53) % 520;
        String[] bodies = {"#2f6f9f", "#8a5a2b", "#4b4b4b", "#7a2e5f", "#2e7a55"};
        String body = bodies[seed % bodies.length];
        boolean redLight = number.startsWith("100000");
        StringBuilder b = new StringBuilder(3200);
        b.append("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ").append(WIDTH).append(' ').append(HEIGHT)
                .append("\" width=\"").append(WIDTH).append("\" height=\"").append(HEIGHT).append("\" role=\"img\" aria-label=\"")
                .append("Sample image ").append(index).append(" for demo case ").append(number).append(", fictitious\">")
                .append("<title>Sample image ").append(index).append(" for demo case ").append(number).append(", fictitious</title>")
                .append("<rect width=\"960\" height=\"540\" fill=\"#cfd8dc\"/>")
                .append("<polygon points=\"300,540 660,540 560,150 400,150\" fill=\"#455a64\"/>")
                .append("<rect x=\"360\" y=\"400\" width=\"240\" height=\"10\" fill=\"#ffffff\"/>")
                .append("<rect x=\"").append(carX).append("\" y=\"250\" width=\"230\" height=\"110\" rx=\"14\" fill=\"").append(body).append("\"/>")
                .append("<rect x=\"").append(carX + 30).append("\" y=\"225\" width=\"170\" height=\"45\" rx=\"10\" fill=\"#b0bec5\"/>")
                .append("<circle cx=\"").append(carX + 50).append("\" cy=\"362\" r=\"24\" fill=\"#212121\"/>")
                .append("<circle cx=\"").append(carX + 180).append("\" cy=\"362\" r=\"24\" fill=\"#212121\"/>")
                .append("<rect x=\"").append(carX + 80).append("\" y=\"318\" width=\"70\" height=\"26\" fill=\"#ffffff\" stroke=\"#212121\"/>")
                .append("<text x=\"").append(carX + 115).append("\" y=\"337\" font-family=\"sans-serif\" font-size=\"16\" font-weight=\"bold\" text-anchor=\"middle\" fill=\"#212121\">SAMPLE</text>");
        if (redLight) {
            b.append("<rect x=\"800\" y=\"90\" width=\"40\" height=\"110\" rx=\"8\" fill=\"#212121\"/>")
                    .append("<circle cx=\"820\" cy=\"120\" r=\"14\" fill=\"#e53935\"/>")
                    .append("<circle cx=\"820\" cy=\"170\" r=\"14\" fill=\"#424242\"/>");
        }
        // Camera banner strip: realistic layout matching real evidence photo banners (Location, Date, Time, Camera, Operator).
        String cameraCode = redLight ? "DEMO-RL-1" : "DEMO-CAM-1";
        String location = (seed % 2 == 0) ? "TEST AVENUE AND DEMO LANE, EXAMPLEVILLE" : "SAMPLE ROAD AND EXAMPLE STREET, SAMPLETOWN";
        b.append("<rect width=\"960\" height=\"80\" fill=\"#212121\"/>")
                .append("<text x=\"12\" y=\"18\" font-family=\"monospace\" font-size=\"13\" fill=\"#ffffff\">Location: ").append(location).append("</text>")
                .append("<text x=\"12\" y=\"36\" font-family=\"monospace\" font-size=\"13\" fill=\"#ffffff\">Date: 14/03/2026  Time: 11:12:00  Camera: ").append(cameraCode).append("</text>")
                .append("<text x=\"12\" y=\"54\" font-family=\"monospace\" font-size=\"13\" fill=\"#ffffff\">Operator: Sample Operator  Incident: ").append(6 + seed % 90).append("</text>")
                .append("<text x=\"12\" y=\"72\" font-family=\"monospace\" font-size=\"13\" fill=\"#ffd54f\">FICTITIOUS DEMO DATA - NOT A REAL PHOTO</text>")
                .append("<text x=\"936\" y=\"72\" font-family=\"monospace\" font-size=\"13\" text-anchor=\"end\" fill=\"#ffffff\">Case ").append(number)
                .append(" img ").append(index).append("</text>");
        // Bottom strip
        b.append("<rect y=\"476\" width=\"960\" height=\"64\" fill=\"#212121\"/>")
                .append("<text x=\"24\" y=\"516\" font-family=\"sans-serif\" font-size=\"22\" fill=\"#ffffff\">Fictitious demo data. Generated, no vehicle or person is shown.</text>")
                .append("</svg>");
        return b.toString();
    }
}
