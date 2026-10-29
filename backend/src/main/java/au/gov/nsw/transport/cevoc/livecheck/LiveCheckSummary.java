package au.gov.nsw.transport.cevoc.livecheck;

import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;

/**
 * Turns a lookup result into a REDACTED text summary for the owner's local check: yes/no and counts only.
 * It never prints the notice number, plate, dates, amounts, location, camera code or any text from the page.
 */
public final class LiveCheckSummary {

    private LiveCheckSummary() {}

    public static String of(PenaltyLookupResult r) {
        StringBuilder sb = new StringBuilder();
        sb.append("state reached      : ").append(state(r)).append('\n');
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
