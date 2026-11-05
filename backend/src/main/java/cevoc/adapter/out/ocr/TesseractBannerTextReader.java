package cevoc.adapter.out.ocr;

import cevoc.application.port.out.BannerTextReaderPort;
import java.awt.Rectangle;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/**
 * The one OCR adapter: the open-source Tesseract engine (Apache-2.0), called as the {@code tesseract} command line program
 * installed in the container image. No library dependency, no cloud service. The picture goes in through standard input and
 * the text comes back through standard output: the crop is never written to disk. Only the top part of the picture is decoded.
 * The text is returned to the caller and never logged here.
 */
public final class TesseractBannerTextReader implements BannerTextReaderPort {

    /** Letters, digits and the punctuation a banner uses (colon, dot, comma, slash, hyphen). Single block of text. */
    static final String WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:.,/- ";

    private final String command;
    private final Duration timeout;

    public TesseractBannerTextReader(String command, Duration timeout) {
        this.command = command == null || command.isBlank() ? "tesseract" : command.trim();
        this.timeout = timeout == null ? Duration.ofSeconds(30) : timeout;
    }

    @Override
    public Reading read(byte[] image) {
        int w = 0;
        int h = 0;
        int strip = 0;
        try {
            if (image == null || image.length == 0) {
                return Reading.failed(0, 0, 0);
            }
            BufferedImage region;
            try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(image))) {
                var readers = ImageIO.getImageReaders(in);
                if (!readers.hasNext()) {
                    return Reading.failed(0, 0, 0);
                }
                ImageReader reader = readers.next();
                try {
                    reader.setInput(in, true, true);
                    w = reader.getWidth(0);
                    h = reader.getHeight(0);
                    int regionHeight = Math.min(h, Math.max(h * 3 / 10, Math.min(h, 300)));
                    ImageReadParam param = reader.getDefaultReadParam();
                    param.setSourceRegion(new Rectangle(0, 0, w, regionHeight));
                    region = reader.read(0, param);
                } finally {
                    reader.dispose();
                }
            }
            strip = BannerStrip.findHeight(region, h);
            BufferedImage ready = BannerStrip.prepare(region, strip);
            ByteArrayOutputStream png = new ByteArrayOutputStream();
            ImageIO.write(ready, "png", png);
            String text = run(png.toByteArray());
            int lines = (int) text.lines().filter(l -> !l.isBlank()).count();
            return new Reading(text, w, h, strip, lines, false);
        } catch (IOException | RuntimeException | OutOfMemoryError e) {
            return Reading.failed(w, h, strip);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Reading.failed(w, h, strip);
        }
    }

    private String run(byte[] png) throws IOException, InterruptedException {
        List<String> cmd = List.of(command, "stdin", "stdout", "-l", "eng", "--psm", "6", "--dpi", "300",
                "-c", "tessedit_char_whitelist=" + WHITELIST, "-c", "preserve_interword_spaces=1");
        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.redirectError(ProcessBuilder.Redirect.DISCARD);
        Process p = pb.start();
        try {
            try (OutputStream os = p.getOutputStream()) {
                os.write(png);
            } catch (IOException e) {
                // the engine may close its input early; the exit status below decides
            }
            if (!p.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                throw new IOException("ocr timeout");
            }
            byte[] out = p.getInputStream().readNBytes(1 << 20);
            if (p.exitValue() != 0) {
                throw new IOException("ocr exit");
            }
            return new String(out, java.nio.charset.StandardCharsets.UTF_8);
        } finally {
            p.destroyForcibly();
        }
    }
}
