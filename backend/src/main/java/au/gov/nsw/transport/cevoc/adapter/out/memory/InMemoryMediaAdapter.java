package au.gov.nsw.transport.cevoc.adapter.out.memory;

import au.gov.nsw.transport.cevoc.application.port.out.MediaReadPort;
import au.gov.nsw.transport.cevoc.application.port.out.MediaStoragePort;
import au.gov.nsw.transport.cevoc.application.port.out.SignedLinkPort;
import au.gov.nsw.transport.cevoc.domain.ImageVariant;
import au.gov.nsw.transport.cevoc.domain.MediaContent;
import au.gov.nsw.transport.cevoc.domain.SignedLink;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import javax.imageio.ImageIO;

/**
 * Smallest working storage for evidence images captured by a live lookup: bytes are held in memory for a short time
 * (default 20 minutes, bounded in total size), then forgotten. Nothing is written to disk, nothing is logged. The
 * container's own file system is not needed, and a restart simply drops the images (the page asks again).
 *
 * <p>Links are unguessable random tokens ({@code <base>/api/media/<token>}); they expire with the stored object. The
 * original is kept untouched at full resolution; the thumbnail and medium copies are made on first request and cached
 * with the object. The base is empty by default (relative links, which the page resolves against its API address).
 */
public class InMemoryMediaAdapter implements MediaStoragePort, SignedLinkPort, MediaReadPort {

    public static final String PATH = "/api/media/";
    static final int THUMBNAIL_WIDTH = 320;
    static final int MEDIUM_WIDTH = 1280;

    private static final class Stored {
        final String contentType;
        final byte[] data;
        final Instant expiresAt;
        byte[] thumbnail;
        byte[] medium;

        Stored(String contentType, byte[] data, Instant expiresAt) {
            this.contentType = contentType;
            this.data = data;
            this.expiresAt = expiresAt;
        }
    }

    private record Token(String objectKey, Instant expiresAt) {}

    private final Clock clock;
    private final Duration retention;
    private final long maxTotalBytes;
    private final String base;
    private final SecureRandom random = new SecureRandom();
    private final Map<String, Stored> objects = new LinkedHashMap<>();
    private final Map<String, Token> tokens = new LinkedHashMap<>();
    private long totalBytes;

    public InMemoryMediaAdapter(String publicBaseUrl, Duration retention, long maxTotalBytes, Clock clock) {
        String b = publicBaseUrl == null ? "" : publicBaseUrl.trim();
        this.base = b.endsWith("/") ? b.substring(0, b.length() - 1) : b;
        this.retention = retention;
        this.maxTotalBytes = maxTotalBytes;
        this.clock = clock;
    }

    @Override
    public synchronized void store(String objectKey, String contentType, InputStream content, long contentLength) {
        byte[] data;
        try {
            data = content.readAllBytes();
        } catch (IOException e) {
            throw new IllegalStateException("could not read the media to store");
        }
        purge();
        Stored old = objects.remove(objectKey);
        if (old != null) {
            totalBytes -= old.data.length;
        }
        // Make room by dropping the oldest objects first. A single object larger than the whole bound is refused.
        if (data.length > maxTotalBytes) {
            throw new IllegalStateException("media larger than the in-memory bound");
        }
        var it = objects.entrySet().iterator();
        while (totalBytes + data.length > maxTotalBytes && it.hasNext()) {
            totalBytes -= it.next().getValue().data.length;
            it.remove();
        }
        objects.put(objectKey, new Stored(contentType == null ? "application/octet-stream" : contentType, data,
                clock.instant().plus(retention)));
        totalBytes += data.length;
    }

    @Override
    public synchronized boolean exists(String objectKey) {
        purge();
        return objects.containsKey(objectKey);
    }

    @Override
    public SignedLink linkFor(String objectKey, Duration validFor) {
        return make(objectKey, validFor, "");
    }

    @Override
    public Optional<SignedLink> linkFor(String objectKey, ImageVariant variant, Duration validFor) {
        synchronized (this) {
            Stored s = objects.get(objectKey);
            if (s == null || !s.contentType.startsWith("image/")) {
                return Optional.empty();
            }
        }
        return Optional.of(make(objectKey, validFor, variant == ImageVariant.THUMBNAIL ? "?s=thumb" : "?s=medium"));
    }

    private synchronized SignedLink make(String objectKey, Duration validFor, String query) {
        purge();
        Stored s = objects.get(objectKey);
        Instant limit = s == null ? clock.instant().plus(validFor) : s.expiresAt;
        Instant expires = clock.instant().plus(validFor);
        if (expires.isAfter(limit)) {
            expires = limit;
        }
        byte[] raw = new byte[18];
        random.nextBytes(raw);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        tokens.put(token, new Token(objectKey, expires));
        return new SignedLink(base + PATH + token + query, expires);
    }

    @Override
    public Optional<MediaContent> read(String token, ImageVariant variant) {
        Stored s;
        synchronized (this) {
            purge();
            Token t = tokens.get(token);
            s = t == null ? null : objects.get(t.objectKey());
        }
        if (s == null) {
            return Optional.empty();
        }
        if (variant == null) {
            return Optional.of(new MediaContent(s.contentType, s.data));
        }
        byte[] smaller = variantOf(s, variant);
        return smaller == null ? Optional.of(new MediaContent(s.contentType, s.data))
                : Optional.of(new MediaContent("image/jpeg", smaller));
    }

    private byte[] variantOf(Stored s, ImageVariant variant) {
        synchronized (s) {
            byte[] cached = variant == ImageVariant.THUMBNAIL ? s.thumbnail : s.medium;
            if (cached != null) {
                return cached;
            }
            byte[] made = resize(s.data, variant == ImageVariant.THUMBNAIL ? THUMBNAIL_WIDTH : MEDIUM_WIDTH);
            if (variant == ImageVariant.THUMBNAIL) {
                s.thumbnail = made;
            } else {
                s.medium = made;
            }
            return made;
        }
    }

    /** JPEG copy no wider than {@code maxWidth}; null when the bytes are not an image the JDK reads or are already smaller. */
    static byte[] resize(byte[] data, int maxWidth) {
        try {
            BufferedImage src = ImageIO.read(new ByteArrayInputStream(data));
            if (src == null || src.getWidth() <= maxWidth) {
                return null;
            }
            BufferedImage cur = toRgb(src);
            int w = cur.getWidth();
            int h = cur.getHeight();
            int targetW = maxWidth;
            int targetH = Math.max(1, Math.round((float) h * targetW / w));
            // Halve step by step while far above the target, then the last step: keeps small text legible.
            while (w / 2 >= targetW) {
                cur = scale(cur, w / 2, Math.max(1, h / 2));
                w = cur.getWidth();
                h = cur.getHeight();
            }
            cur = scale(cur, targetW, targetH);
            return jpeg(cur);
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private static BufferedImage toRgb(BufferedImage src) {
        if (src.getType() == BufferedImage.TYPE_INT_RGB) {
            return src;
        }
        BufferedImage out = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        var g = out.createGraphics();
        g.setColor(java.awt.Color.WHITE);
        g.fillRect(0, 0, out.getWidth(), out.getHeight());
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return out;
    }

    private static BufferedImage scale(BufferedImage src, int w, int h) {
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return out;
    }

    private static byte[] jpeg(BufferedImage img) throws IOException {
        Iterator<javax.imageio.ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            return null;
        }
        javax.imageio.ImageWriter writer = writers.next();
        var param = writer.getDefaultWriteParam();
        param.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(0.85f);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (var ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            writer.write(null, new javax.imageio.IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
        return out.toByteArray();
    }

    /** Drops expired objects and tokens. Caller holds the lock. */
    private void purge() {
        Instant now = clock.instant();
        var oi = objects.entrySet().iterator();
        while (oi.hasNext()) {
            Stored s = oi.next().getValue();
            if (!s.expiresAt.isAfter(now)) {
                totalBytes -= s.data.length;
                oi.remove();
            }
        }
        tokens.values().removeIf(t -> !t.expiresAt().isAfter(now) || !objects.containsKey(t.objectKey()));
    }

    @Override
    public String toString() {
        return "InMemoryMediaAdapter";
    }
}
