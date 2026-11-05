package cevoc.adapter.out.demo;

import cevoc.adapter.out.demo.DemoScenario.Shape;
import cevoc.domain.CertificateItem;
import cevoc.domain.CertificateMatch;
import cevoc.domain.CertificateRef;
import cevoc.domain.EnforcementMethod;
import cevoc.domain.NoticeDetails;
import cevoc.domain.NoticeStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The one place that turns a demo notice number into a case. It parses prefix and sequence ({@link DemoNumber}), finds the
 * scenario ({@link DemoScenarios}) and builds, deterministically and without any network call, the text record
 * ({@link #textRecord}) and, through a {@link DemoMediaSource}, the media set ({@link #mediaSet}). Text and media stay
 * separate so a later step can swap the media source without touching the text. Failure conditions are part of the scenario
 * and are played out by {@link DemoPenaltyLookupAdapter}. All values are fictitious.
 */
public final class DemoCaseFactory {

    /** The fictitious number plate that releases held-back images. */
    public static final String PLATE = "TST123";
    /** The {@code source} value of every demo result; the page uses it to show the demo banner. */
    public static final String SOURCE = "DEMO";

    private static final DateTimeFormatter PERIOD = DateTimeFormatter.ofPattern("dd/MM/uuuu");
    private static final int[] CLASS_BASE = {1, 101, 201, 301};

    private final DemoMediaSource media;
    private final List<DemoScenario> scenarios = DemoScenarios.all();
    private final Map<String, DemoScenario> byNumber = new LinkedHashMap<>();

    public DemoCaseFactory(DemoMediaSource media) {
        this.media = media;
        for (DemoScenario s : scenarios) {
            byNumber.put(s.number(), s);
        }
    }

    public DemoMediaSource mediaSource() {
        return media;
    }

    /** Every listed scenario, in display order. */
    public List<DemoScenario> scenarios() {
        return scenarios;
    }

    /**
     * The scenario for a number: the listed one, or for an unlisted sequence of a built program the first case of its range
     * (happy 0001, partial 0101, sad 0201, edge 0301) carrying that sequence. Empty for anything that is not a built demo number.
     */
    public Optional<DemoScenario> scenario(String number) {
        Optional<DemoNumber> n = DemoNumber.parse(number);
        if (n.isEmpty() || !n.get().program().built()) {
            return Optional.empty();
        }
        DemoScenario exact = byNumber.get(number);
        if (exact != null) {
            return Optional.of(exact);
        }
        DemoNumber d = n.get();
        DemoScenario base = byNumber.get(new DemoNumber(d.program(), CLASS_BASE[d.kind().ordinal()]).text());
        return Optional.ofNullable(base).map(b -> b.withSequence(d.sequence()));
    }

    public DemoMediaSet mediaSet(DemoScenario s) {
        return media.mediaFor(s);
    }

    public DemoTextRecord textRecord(DemoScenario s) {
        NoticeDetails notice = new NoticeDetails(offenceText(s), s.offenceDate(), s.offenceTime(), location(s), penalty(s),
                owing(s), s.noticeStatus(), s.statusMessage(), EnforcementMethod.CAMERA);
        return new DemoTextRecord(notice, "Demo data only. This is not a real notice.", detailsMap(s), certificates(s));
    }

    private static String offenceText(DemoScenario s) {
        if (s.shape() == Shape.UNKNOWN_PROGRAM_TEXT) {
            return "Camera recorded offence";
        }
        return s.program() == DemoProgram.RED_LIGHT ? "Fail to stop at red traffic light" : "Exceed speed limit by 10km/h or less";
    }

    private static String location(DemoScenario s) {
        if (s.shape() == Shape.LONG_LOCATION) {
            StringBuilder b = new StringBuilder("SAMPLE ROAD AND EXAMPLE STREET");
            while (b.length() < 300) {
                b.append(", NORTHBOUND APPROACH TO THE SAMPLE INTERSECTION AFTER THE SECOND EXAMPLE CROSSING");
            }
            return b.substring(0, 300).stripTrailing();
        }
        return s.sequence() % 2 == 0 ? "TEST AVENUE AND DEMO LANE, EXAMPLEVILLE" : "SAMPLE ROAD AND EXAMPLE STREET, SAMPLETOWN";
    }

    private static BigDecimal penalty(DemoScenario s) {
        if (s.shape() == Shape.EXTREME_VALUES) {
            return new BigDecimal("99999.99");
        }
        return s.program() == DemoProgram.RED_LIGHT ? new BigDecimal("464.00") : new BigDecimal("277.00");
    }

    private static BigDecimal owing(DemoScenario s) {
        return s.noticeStatus() == NoticeStatus.PAID ? new BigDecimal("0.00") : penalty(s);
    }

    private static Map<String, Object> detailsMap(DemoScenario s) {
        if (s.details() == DemoScenario.Details.NONE || s.shape() == Shape.UNKNOWN_PROGRAM_TEXT) {
            return Map.of();
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("cameraCode", "7109");
        m.put("operator", "Sample Operator");
        m.put("bannerLocation", location(s).length() > 60 ? location(s).substring(0, 60).stripTrailing() : location(s));
        m.put("incidentNumber", String.valueOf(6 + s.sequence() % 90));
        m.put("bannerDate", s.offenceDate().toString());
        m.put("bannerTime", s.offenceTime().format(DateTimeFormatter.ofPattern("HH:mm:ss")));
        if (s.program() == DemoProgram.RED_LIGHT) {
            m.put("direction", "Northbound");
            m.put("lane", "Lane 2");
            m.put("offenceText", "Red light");
            m.put("timeSinceRed", s.timeSinceRed());
            m.put("yellowLightDuration", 4.0);
            if (s.details() != DemoScenario.Details.SOME_MISSING) {
                m.put("speedLimit", s.shape() == Shape.EXTREME_VALUES ? 130 : 60);
            }
        } else {
            m.put("offenceText", "Camera recorded");
        }
        return m;
    }

    private static List<CertificateItem> certificates(DemoScenario s) {
        LocalDate d = s.offenceDate();
        String what = "Fictitious " + s.program().label().toLowerCase() + " camera certificate";
        List<CertificateRef> rows = new ArrayList<>();
        switch (s.certs()) {
            case COVERING -> {
                rows.add(row(what + " (superseded)", d.minusYears(3), d.minusYears(1).minusDays(1)));
                rows.add(row(what + " (current)", d.minusYears(1), d.plusYears(1)));
                rows.add(row(what + " (next year)", d.plusYears(1).plusDays(1), d.plusYears(3)));
            }
            case NOT_COVERING -> {
                rows.add(row(what + " (expired before the offence)", d.minusYears(3), d.minusDays(40)));
                rows.add(row(what + " (starts after the offence)", d.plusDays(40), d.plusYears(2)));
            }
            case NONE, FAILED -> { }
        }
        LocalDateTime at = d.atTime(s.offenceTime());
        return CertificateMatch.mark(rows, at).stream().map(CertificateItem::from).toList();
    }

    private static CertificateRef row(String description, LocalDate from, LocalDate to) {
        return new CertificateRef(description, "Camera", PERIOD.format(from) + " - " + PERIOD.format(to), from.atStartOfDay(),
                to.atTime(23, 59), from.minusDays(10).atStartOfDay(), to.atStartOfDay(), null);
    }
}
