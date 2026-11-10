package cevoc.adapter.out.demo;

import cevoc.adapter.out.demo.DemoScenario.Certs;
import cevoc.adapter.out.demo.DemoScenario.Details;
import cevoc.adapter.out.demo.DemoScenario.Outcome;
import cevoc.adapter.out.demo.DemoScenario.Plate;
import cevoc.adapter.out.demo.DemoScenario.Shape;
import cevoc.domain.NoticeStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * THE list of demo cases. Everything else (factory, hub page, docs/DEMO-DATA.md table, visual check) is derived from it.
 * Sequence ranges: 0001-0099 happy, 0100-0199 partial, 0200-0299 sad, 0300 and up edge, the same for every built program.
 * A number in a range that is not listed here behaves like the first case of its range (see {@link DemoCaseFactory}).
 * Fictitious values only. The road safety trigger cases use the illustrative thresholds of decision record 0012
 * (time since red 1.0 s, night from 20:00); no message engine exists yet, so they only show the values.
 */
public final class DemoScenarios {

    private DemoScenarios() {}

    static final LocalDate FAR_PAST = LocalDate.of(1999, 12, 31);

    public static List<DemoScenario> all() {
        List<DemoScenario> out = new ArrayList<>();
        for (DemoProgram p : new DemoProgram[] {DemoProgram.DEFAULT, DemoProgram.RED_LIGHT}) {
            boolean red = p == DemoProgram.RED_LIGHT;
            // ---- happy: everything returned
            out.add(s(p, 1).title("Everything returned",
                    "Three images, a certificate covering the offence date, " + (red ? "all red light details, " : "") + "and a video."));
            out.add(s(p, 2).title("Everything returned, evening",
                    "Same as 0001 for an evening offence at a different place.").time(LocalTime.of(21, 40)).certs(Certs.SINGLE));
            // ---- partial: something is missing, said plainly
            out.add(s(p, 101).title("No certificate returned", "Images and video are there; the certificate list is empty.")
                    .certs(Certs.NONE));
            out.add(s(p, 102).title("Certificate does not cover the date",
                    "A certificate is listed but none was in force on the offence date.").certs(Certs.NOT_COVERING));
            out.add(s(p, 103).title("No video returned", "Images and a covering certificate; no video.").video(false));
            if (red) {
                out.add(s(p, 104).title("Some red light details not returned",
                        "The seconds after red are there; the speed limit is not.").details(Details.SOME_MISSING));
            }
            out.add(s(p, 105).title("One image only", "A single image instead of three; no video.").images(1).video(false));
            out.add(s(p, 106).title("Wrong registration refused",
                    "Any registration other than " + DemoCaseFactory.PLATE + " is refused.").plate(Plate.REJECTS_ALL));
            out.add(s(p, 107).title("Notice already paid", "Everything returned; the notice is paid and nothing is owing.")
                    .status(NoticeStatus.PAID, "This penalty has been paid."));
            out.add(s(p, 108).title("Notice in review", "Everything returned; the notice is under review.")
                    .status(NoticeStatus.OTHER, "This notice is under review. Contact Revenue NSW about its current status."));
            out.add(s(p, 109).title("All certificate types covered",
                    "Two certificate types (accuracy and calibration); both cover the offence date.").certs(Certs.ALL_TYPES_COVERED));
            out.add(s(p, 110).title("One certificate type uncovered",
                    "Two certificate types; the accuracy certificate covers the date but the calibration certificate does not.")
                    .certs(Certs.ONE_TYPE_UNCOVERED));
            out.add(s(p, 111).title("Mixed certificate types",
                    "Three certificate types; accuracy and calibration cover the date but the maintenance certificate does not.")
                    .certs(Certs.MIXED));
            // ---- sad: something failed
            out.add(s(p, 201).title("Certificate lookup failed", "Images and video are there; the certificate lookup has a technical failure.")
                    .certs(Certs.FAILED));
            out.add(s(p, 202).title("Image retrieval failed",
                    "The notice is found, then the image step fails; images, certificates and video are reported failed.")
                    .outcome(Outcome.IMAGES_FAIL));
            if (red) {
                out.add(s(p, 203).title("Details missing entirely", "Images, certificate and video are there; no red light details at all.")
                        .details(Details.NONE));
            }
            out.add(s(p, 204).title("Source timed out", "The source does not answer in time; no details at all.").outcome(Outcome.TIMEOUT));
            out.add(s(p, 205).title("Notice not found", "The source does not know this notice.").outcome(Outcome.NOT_FOUND));
            out.add(s(p, 206).title("Wrong plate, always refused",
                    "Images are held back and every number plate is refused, so the page says so.").plate(Plate.REJECTS_ALL));
            // ---- edge
            out.add(s(p, 301).title("Offence date before any configuration version",
                    red ? "Dated 31 Dec 1999, before the first display rules; the page says it has no rules for that date."
                            : "Dated 31 Dec 1999; the default block never fails and is used as always.").date(FAR_PAST));
            if (red) {
                out.add(s(p, 302).title("Unknown program falls to the default block",
                        "Camera notice whose offence text and details match no program, so the default block shows.")
                        .shape(Shape.UNKNOWN_PROGRAM_TEXT).details(Details.NONE));
            }
            out.add(s(p, 303).title("Very long location text", "The location is about 300 characters long.").shape(Shape.LONG_LOCATION));
            out.add(s(p, 304).title("Extreme values",
                    "Penalty $99,999.99, offence at 23:59:59" + (red ? ", 59.9 seconds after red, speed limit 130" : "") + ".")
                    .shape(Shape.EXTREME_VALUES).time(LocalTime.of(23, 59, 59)).timeSinceRed(59.9));
            if (red) {
                out.add(s(p, 305).title("Time after red just under 1.0 s", "0.9 seconds after red, just under the illustrative late-red threshold.")
                        .timeSinceRed(0.9));
                out.add(s(p, 306).title("Time after red exactly 1.0 s", "1.0 seconds after red, exactly at the threshold.").timeSinceRed(1.0));
                out.add(s(p, 307).title("Time after red just over 1.0 s", "1.1 seconds after red, just over the threshold.").timeSinceRed(1.1));
                out.add(s(p, 308).title("Offence at 19:59, just before night", "Just under the illustrative night threshold of 20:00.")
                        .time(LocalTime.of(19, 59)));
                out.add(s(p, 309).title("Offence at 20:00, night starts", "Exactly at the night threshold.").time(LocalTime.of(20, 0)));
                out.add(s(p, 310).title("Offence at 20:01, just into night", "Just over the night threshold.").time(LocalTime.of(20, 1)));
            }
        }
        return List.copyOf(out);
    }

    private static DemoScenario s(DemoProgram p, int seq) {
        return DemoScenario.of(p, seq);
    }
}
