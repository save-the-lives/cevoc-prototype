package cevoc.adapter.out.demo;

import java.util.Optional;

/**
 * A fictitious demo notice number: TEN digits, the first six are the program prefix (see {@link DemoProgram}) and the
 * last four the sequence. Sequence ranges are the same for every program: 0001 to 0099 happy, 0100 to 0199 partial,
 * 0200 to 0299 sad, 0300 and up edge. This is the only place that reads the scheme.
 */
public record DemoNumber(DemoProgram program, int sequence) {

    public enum Kind {
        HAPPY("Happy", "0001-0099"), PARTIAL("Partial", "0100-0199"), SAD("Sad", "0200-0299"), EDGE("Edge", "0300-9999");

        private final String title;
        private final String range;

        Kind(String title, String range) {
            this.title = title;
            this.range = range;
        }

        public String title() {
            return title;
        }

        public String range() {
            return range;
        }

        public static Kind ofSequence(int sequence) {
            return sequence < 100 ? HAPPY : sequence < 200 ? PARTIAL : sequence < 300 ? SAD : EDGE;
        }
    }

    /** The parsed number, or empty when it is not ten digits, has an unknown prefix or sequence 0000. */
    public static Optional<DemoNumber> parse(String text) {
        if (text == null || text.length() != 10) {
            return Optional.empty();
        }
        for (int i = 0; i < 10; i++) {
            char c = text.charAt(i);
            if (c < '0' || c > '9') {
                return Optional.empty();
            }
        }
        int seq = Integer.parseInt(text.substring(6));
        if (seq < 1) {
            return Optional.empty();
        }
        return DemoProgram.ofPrefix(text.substring(0, 6)).map(p -> new DemoNumber(p, seq));
    }

    public Kind kind() {
        return Kind.ofSequence(sequence);
    }

    public String text() {
        return program.prefix() + String.format("%04d", sequence);
    }
}
