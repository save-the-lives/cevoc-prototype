package cevoc.adapter.out.demo;

import java.util.Optional;

/** The program blocks of the demo number scheme: the first six digits of a demo notice number. */
public enum DemoProgram {
    DEFAULT("000000", "Default block", true, "Notices whose program is not configured: the page uses the default block."),
    RED_LIGHT("100000", "Red light", true, "Red light camera, the one program built so far."),
    FIXED_SPEED("200000", "Fixed speed", false, "Reserved, not built yet."),
    MOBILE_SPEED("300000", "Mobile speed", false, "Reserved, not built yet."),
    AVERAGE_SPEED("400000", "Average speed", false, "Reserved, not built yet."),
    PHONE_DETECTION("500000", "Mobile phone detection", false, "Reserved, not built yet."),
    BUS_LANE("600000", "Bus lane", false, "Reserved, not built yet.");

    private final String prefix;
    private final String label;
    private final boolean built;
    private final String note;

    DemoProgram(String prefix, String label, boolean built, String note) {
        this.prefix = prefix;
        this.label = label;
        this.built = built;
        this.note = note;
    }

    public String prefix() {
        return prefix;
    }

    public String label() {
        return label;
    }

    /** False for a reserved prefix: the hub lists it as "not built yet" and no case is produced for it. */
    public boolean built() {
        return built;
    }

    public String note() {
        return note;
    }

    public static Optional<DemoProgram> ofPrefix(String prefix) {
        for (DemoProgram p : values()) {
            if (p.prefix.equals(prefix)) {
                return Optional.of(p);
            }
        }
        return Optional.empty();
    }
}
