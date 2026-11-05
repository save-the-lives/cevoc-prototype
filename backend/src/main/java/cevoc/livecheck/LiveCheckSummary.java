package cevoc.livecheck;

import cevoc.domain.ImageSize;
import cevoc.domain.LookupTrace;
import cevoc.domain.NoticeDetails;
import cevoc.domain.PenaltyLookupResult;

/**
 * Turns a lookup result into a REDACTED text summary for the owner's local check: yes/no and counts only.
 * It never prints the notice number, plate, dates, amounts, location, camera code or any text from the page.
 */
public final class LiveCheckSummary {

    private LiveCheckSummary() {}

    public static String of(PenaltyLookupResult r) {
        return of(r, null);
    }

    /** {@code failure} is a fixed-vocabulary reason from LookupDiagnostic (step, cause token, yes/no markers), or null. */
    public static String of(PenaltyLookupResult r, String failure) {
        return of(r, failure, null);
    }

    /**
     * {@code trace} (may be null) adds one line per lookup step, the first failed step and, per captured image,
     * numbers only: pixel size, byte count, capture path, and the rendered and natural size of the page element.
     */
    public static String of(PenaltyLookupResult r, String failure, LookupTrace trace) {
        StringBuilder sb = new StringBuilder();
        sb.append("state reached      : ").append(state(r)).append('\n');
        if (trace != null) {
            for (LookupTrace.Entry e : trace.entries()) {
                sb.append("step ").append(e.step().number()).append(' ').append(e.step().label()).append(" : ")
                        .append(e.outcome().label()).append(' ').append(e.millis()).append("ms");
                if (e.cause() != null) {
                    sb.append(" cause=").append(e.cause().token());
                }
                sb.append('\n');
            }
            LookupTrace.Entry first = trace.firstFailed();
            sb.append("first failed step  : ")
                    .append(first == null ? "none" : first.step().number() + " " + first.step().label() + " (" + first.cause().token() + ")")
                    .append('\n');
        }
        if (present(failure)) {
            sb.append("failure detail     : ").append(failure).append('\n');
        }
        sb.append("lookup status      : ").append(r.status()).append('\n');
        NoticeDetails n = r.notice();
        sb.append("fields found       : ");
        if (n == null) {
            sb.append("(no notice details)\n");
        } else {
            sb.append('\n');
            line(sb, "offence date", n.offenceDate() != null);
            line(sb, "offence time", n.offenceTime() != null);
            line(sb, "offence description", present(n.offenceDescription()));
            line(sb, "location", present(n.location()));
            line(sb, "penalty amount", n.penaltyAmount() != null);
            line(sb, "amount owing", n.amountOwing() != null);
            line(sb, "notice status", n.noticeStatus() != null);
            line(sb, "status message", present(n.statusMessage()));
            line(sb, "enforcement method", n.enforcementMethod() != null);
        }
        int images = r.evidence() == null ? 0 : r.evidence().size();
        sb.append("images             : ").append(images).append('\n');
        if (trace != null) {
            appendImageSizes(sb, trace);
        }
        sb.append("details keys      : ").append(detailKeys(r)).append('\n');
        sb.append("camera code found  : ").append(present(r.cameraCode()) ? "yes" : "no").append('\n');
        sb.append("certificates       : ").append(r.certificates().size());
        if (r.certificates().stream().anyMatch(c -> c.coversOffence())) {
            sb.append(" (at least one covers the offence)");
        }
        sb.append('\n');
        if (present(r.certificatesNote())) {
            sb.append("certificates note  : ").append(r.certificatesNote()).append('\n');
        }
        return sb.toString();
    }

    private static void appendImageSizes(StringBuilder sb, LookupTrace trace) {
        int i = 0;
        boolean canvas = false;
        for (ImageSize z : trace.images()) {
            i++;
            canvas |= z.path() == cevoc.domain.CapturePath.CANVAS;
            sb.append("image ").append(i).append("            : ").append(px(z.width(), z.height())).append(", ")
                    .append(z.bytes()).append(" bytes, via ").append(z.path().label()).append('\n');
            sb.append("  rendered size: ").append(px(z.renderedWidth(), z.renderedHeight())).append('\n');
            sb.append("  natural size: ").append(px(z.naturalWidth(), z.naturalHeight())).append('\n');
        }
        if (canvas) {
            sb.append("image note         : canvas capture may be thumbnail resolution; if natural size is larger than the captured size, the original is larger\n");
        }
    }

    /** Names of the keys in the details map, never values; names are cut to a safe vocabulary (letters and digits, 40 characters). */
    static String detailKeys(PenaltyLookupResult r) {
        if (r.details() == null || r.details().isEmpty()) {
            return "(none)";
        }
        return r.details().keySet().stream().map(k -> k.replaceAll("[^A-Za-z0-9_.-]", "_")).map(k -> k.length() > 40 ? k.substring(0, 40) : k)
                .sorted().collect(java.util.stream.Collectors.joining(", "));
    }

    private static String px(int w, int h) {
        return w > 0 && h > 0 ? w + "x" + h + " px" : "unknown";
    }

    static String state(PenaltyLookupResult r) {
        return switch (r.status()) {
            case LIVE_LOOKUP_OFF, LIVE_LOOKUP_DISABLED -> "none (lookup switched off or not configured)";
            case NOT_FOUND -> "1 login (notice and date not matched)";
            case UNAVAILABLE -> "failed (browser or page not readable; see backend console)";
            case FOUND -> r.evidence() != null && !r.evidence().isEmpty() ? "3 images"
                    : "2 summary (no images: no plate given, plate not accepted, or none shown)";
        };
    }

    private static void line(StringBuilder sb, String label, boolean found) {
        sb.append("  ").append(label).append(": ").append(found ? "yes" : "no").append('\n');
    }

    private static boolean present(String s) {
        return s != null && !s.isBlank();
    }
}
