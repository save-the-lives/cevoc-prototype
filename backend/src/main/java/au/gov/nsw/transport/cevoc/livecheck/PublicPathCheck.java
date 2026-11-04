package au.gov.nsw.transport.cevoc.livecheck;

import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import java.util.regex.Pattern;

/**
 * Proves the PUBLIC image path in the live-check summary: how many images the public result holds, and whether each
 * link (original, medium, thumbnail) can be fetched, as numbers only: HTTP status, content type, byte count and whether
 * the cross-origin header for the web page's origin came back. It prints no link, token, notice value or image content.
 */
public final class PublicPathCheck {

    /** What one fetch returned. {@code status} 0 = the fetch itself failed. */
    public record Fetched(int status, String contentType, long bytes, boolean cors) {}

    @FunctionalInterface
    public interface Probe {
        Fetched fetch(String url);
    }

    private static final Pattern TYPE = Pattern.compile("[a-z]+/[a-z0-9.+-]+");

    private PublicPathCheck() {}

    public static String lines(PenaltyLookupResult r, Probe probe) {
        StringBuilder sb = new StringBuilder();
        long images = r.evidence() == null ? 0 : r.evidence().stream().filter(e -> e.kind() == EvidenceItem.Kind.IMAGE).count();
        sb.append("public images      : ").append(images).append(" in the public result\n");
        sb.append("public plate flag  : ").append(r.plateRequired() ? "plate required" : "not required").append('\n');
        if (probe == null || images == 0) {
            sb.append("public links       : ").append(images == 0 ? "none to fetch" : "not checked").append('\n');
            return sb.toString();
        }
        int n = 0;
        int ok = 0;
        int total = 0;
        StringBuilder detail = new StringBuilder();
        for (EvidenceItem e : r.evidence()) {
            if (e.kind() != EvidenceItem.Kind.IMAGE) {
                continue;
            }
            n++;
            String[][] sizes = {{"full", e.url()}, {"medium", e.mediumUrl()}, {"thumbnail", e.previewUrl()}};
            for (String[] s : sizes) {
                if (s[1] == null) {
                    detail.append("public link ").append(n).append(' ').append(s[0]).append(": none\n");
                    continue;
                }
                total++;
                Fetched f = safe(probe, s[1]);
                if (f.status() == 200 && f.contentType().startsWith("image/") && f.bytes() > 0) {
                    ok++;
                }
                detail.append("public link ").append(n).append(' ').append(s[0]).append(": HTTP ").append(f.status())
                        .append(", ").append(f.contentType()).append(", ").append(f.bytes()).append(" bytes, cors ")
                        .append(f.cors() ? "yes" : "no")
                        .append(e.width() != null && s[0].equals("full") ? ", original " + e.width() + "x" + e.height() + " px" : "")
                        .append('\n');
            }
        }
        sb.append("public links       : ").append(ok).append(" of ").append(total).append(" fetched as images\n").append(detail);
        return sb.toString();
    }

    private static Fetched safe(Probe probe, String url) {
        try {
            Fetched f = probe.fetch(url);
            String type = f.contentType() == null ? "" : f.contentType().split(";")[0].trim().toLowerCase(java.util.Locale.ROOT);
            return new Fetched(f.status(), TYPE.matcher(type).matches() ? type : "other", f.bytes(), f.cors());
        } catch (RuntimeException e) {
            return new Fetched(0, "none", 0, false);
        }
    }
}
