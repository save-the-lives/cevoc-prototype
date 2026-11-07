package cevoc.adapter.out.demo;

import cevoc.domain.NoticeStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.EnumMap;
import java.util.Map;

/**
 * One demo case, described as data. The scenario list in {@link DemoScenarios} is the single source of truth: the
 * factory, the hub page, the generated table in docs/DEMO-DATA.md and the visual check all read it. All values are fictitious.
 */
public final class DemoScenario {

    /** How the lookup ends. */
    public enum Outcome {
        /** Notice found and everything else follows the other fields. */
        FOUND,
        /** The source does not know the notice. */
        NOT_FOUND,
        /** The source did not answer in time (no details at all). */
        TIMEOUT,
        /** The notice is found, then the images step fails; the rest of the lookup is reported failed. */
        IMAGES_FAIL
    }

    /** Whether the images are released only with the number plate. */
    public enum Plate {
        /** No plate needed. */
        NONE,
        /** Images are released when the plate is {@value DemoCaseFactory#PLATE}. */
        GATED,
        /** Images are held back and every plate is refused. */
        REJECTS_ALL
    }

    /**
     * What the demo certificate source finds for the case's camera: three rows of which one covers the offence, a single
     * covering row, rows of which none covers the offence, no rows, or a simulated source failure.
     */
    public enum Certs { COVERING, SINGLE, NOT_COVERING, NONE, FAILED, ALL_TYPES_COVERED, ONE_TYPE_UNCOVERED, MIXED }

    public enum Details { FULL, SOME_MISSING, NONE }

    public enum Shape { NORMAL, LONG_LOCATION, EXTREME_VALUES, UNKNOWN_PROGRAM_TEXT }

    final DemoProgram program;
    final int seq;
    String title = "";
    String description = "";
    LocalDate offenceDate = LocalDate.of(2026, 3, 14);
    LocalTime offenceTime = LocalTime.of(11, 12);
    Outcome outcome = Outcome.FOUND;
    int images = 3;
    Plate plate = Plate.NONE;
    Certs certs = Certs.COVERING;
    boolean video = true;
    Details details = Details.FULL;
    Shape shape = Shape.NORMAL;
    NoticeStatus noticeStatus = NoticeStatus.PAYABLE;
    String statusMessage = "Payment is due.";
    double timeSinceRed = 2.3;

    private DemoScenario(DemoProgram program, int seq) {
        this.program = program;
        this.seq = seq;
    }

    static DemoScenario of(DemoProgram program, int seq) {
        return new DemoScenario(program, seq);
    }

    /** A copy for another sequence in the same program (used for numbers that are not listed). */
    DemoScenario withSequence(int newSeq) {
        DemoScenario c = new DemoScenario(program, newSeq);
        c.title = title;
        c.description = description;
        c.offenceDate = offenceDate;
        c.offenceTime = offenceTime;
        c.outcome = outcome;
        c.images = images;
        c.plate = plate;
        c.certs = certs;
        c.video = video;
        c.details = details;
        c.shape = shape;
        c.noticeStatus = noticeStatus;
        c.statusMessage = statusMessage;
        c.timeSinceRed = timeSinceRed;
        return c;
    }

    DemoScenario title(String v, String d) {
        this.title = v;
        this.description = d;
        return this;
    }

    DemoScenario date(LocalDate v) {
        this.offenceDate = v;
        return this;
    }

    DemoScenario time(LocalTime v) {
        this.offenceTime = v;
        return this;
    }

    DemoScenario outcome(Outcome v) {
        this.outcome = v;
        return this;
    }

    DemoScenario images(int v) {
        this.images = v;
        return this;
    }

    DemoScenario plate(Plate v) {
        this.plate = v;
        return this;
    }

    DemoScenario certs(Certs v) {
        this.certs = v;
        return this;
    }

    DemoScenario video(boolean v) {
        this.video = v;
        return this;
    }

    DemoScenario details(Details v) {
        this.details = v;
        return this;
    }

    DemoScenario shape(Shape v) {
        this.shape = v;
        return this;
    }

    DemoScenario status(NoticeStatus v, String message) {
        this.noticeStatus = v;
        this.statusMessage = message;
        return this;
    }

    DemoScenario timeSinceRed(double v) {
        this.timeSinceRed = v;
        return this;
    }

    public DemoProgram program() {
        return program;
    }

    public int sequence() {
        return seq;
    }

    public String number() {
        return new DemoNumber(program, seq).text();
    }

    public DemoNumber.Kind kind() {
        return DemoNumber.Kind.ofSequence(seq);
    }

    public String title() {
        return title;
    }

    public String description() {
        return description;
    }

    public LocalDate offenceDate() {
        return offenceDate;
    }

    public LocalTime offenceTime() {
        return offenceTime;
    }

    public Outcome outcome() {
        return outcome;
    }

    public int images() {
        return images;
    }

    public Plate plate() {
        return plate;
    }

    public Certs certs() {
        return certs;
    }

    public boolean video() {
        return video;
    }

    public Details details() {
        return details;
    }

    public Shape shape() {
        return shape;
    }

    public NoticeStatus noticeStatus() {
        return noticeStatus;
    }

    public String statusMessage() {
        return statusMessage;
    }

    public double timeSinceRed() {
        return timeSinceRed;
    }

    /** True for the program-specific facts of a red light notice (the page only has display rules for those). */
    public boolean hasProgramDetails() {
        return program == DemoProgram.RED_LIGHT && shape != Shape.UNKNOWN_PROGRAM_TEXT;
    }

    /** True when the offence date is before the first date any display configuration version covers (1 Jan 2000). */
    public boolean outsideConfigVersions() {
        return offenceDate.isBefore(LocalDate.of(2000, 1, 1));
    }

    /** What the page is expected to show per information type. A test checks this against what the adapter really returns. */
    public Map<DemoInfo, DemoStatus> expected() {
        Map<DemoInfo, DemoStatus> m = new EnumMap<>(DemoInfo.class);
        if (outcome == Outcome.NOT_FOUND) {
            for (DemoInfo i : DemoInfo.values()) {
                m.put(i, DemoStatus.NOT_APPLICABLE);
            }
            return m;
        }
        if (outcome == Outcome.TIMEOUT) {
            for (DemoInfo i : DemoInfo.values()) {
                m.put(i, DemoStatus.FAILED);
            }
            return m;
        }
        boolean failed = outcome == Outcome.IMAGES_FAIL;
        m.put(DemoInfo.IMAGES, failed ? DemoStatus.FAILED : plate != Plate.NONE ? DemoStatus.HELD_BACK
                : images == 0 ? DemoStatus.NOT_RETURNED : images == 1 ? DemoStatus.PARTIAL : DemoStatus.AVAILABLE);
        m.put(DemoInfo.CERTIFICATES, failed ? DemoStatus.FAILED : switch (certs) {
            case COVERING, SINGLE, ALL_TYPES_COVERED -> DemoStatus.AVAILABLE;
            case NOT_COVERING, ONE_TYPE_UNCOVERED, MIXED -> DemoStatus.PARTIAL;
            case NONE -> DemoStatus.NOT_RETURNED;
            case FAILED -> DemoStatus.FAILED;
        });
        m.put(DemoInfo.VIDEO, failed ? DemoStatus.FAILED : plate != Plate.NONE ? DemoStatus.HELD_BACK
                : video ? DemoStatus.AVAILABLE : DemoStatus.NOT_RETURNED);
        m.put(DemoInfo.DETAILS, !hasProgramDetails() || outsideConfigVersions() ? DemoStatus.NO_RULES
                : failed ? DemoStatus.NOT_RETURNED
                : switch (details) {
                    case FULL -> DemoStatus.AVAILABLE;
                    case SOME_MISSING -> DemoStatus.PARTIAL;
                    case NONE -> DemoStatus.NOT_RETURNED;
                });
        return m;
    }
}
