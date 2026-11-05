package cevoc.adapter.out.demo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class DemoNumberTest {

    @Test
    void tenDigitsPrefixAndSequence() {
        DemoNumber n = DemoNumber.parse("1000000106").orElseThrow();
        assertThat(n.program()).isEqualTo(DemoProgram.RED_LIGHT);
        assertThat(n.sequence()).isEqualTo(106);
        assertThat(n.kind()).isEqualTo(DemoNumber.Kind.PARTIAL);
        assertThat(n.text()).isEqualTo("1000000106");
    }

    @Test
    void sequenceRangesAreTheSameForEveryProgram() {
        assertThat(DemoNumber.Kind.ofSequence(1)).isEqualTo(DemoNumber.Kind.HAPPY);
        assertThat(DemoNumber.Kind.ofSequence(99)).isEqualTo(DemoNumber.Kind.HAPPY);
        assertThat(DemoNumber.Kind.ofSequence(100)).isEqualTo(DemoNumber.Kind.PARTIAL);
        assertThat(DemoNumber.Kind.ofSequence(199)).isEqualTo(DemoNumber.Kind.PARTIAL);
        assertThat(DemoNumber.Kind.ofSequence(200)).isEqualTo(DemoNumber.Kind.SAD);
        assertThat(DemoNumber.Kind.ofSequence(299)).isEqualTo(DemoNumber.Kind.SAD);
        assertThat(DemoNumber.Kind.ofSequence(300)).isEqualTo(DemoNumber.Kind.EDGE);
        assertThat(DemoNumber.Kind.ofSequence(9999)).isEqualTo(DemoNumber.Kind.EDGE);
    }

    @Test
    void anythingElseIsNotADemoNumber() {
        assertThat(DemoNumber.parse(null)).isEmpty();
        assertThat(DemoNumber.parse("")).isEmpty();
        assertThat(DemoNumber.parse("900000001")).isEmpty();      // nine digits
        assertThat(DemoNumber.parse("10000000011")).isEmpty();    // eleven digits
        assertThat(DemoNumber.parse("100000000A")).isEmpty();     // a letter
        assertThat(DemoNumber.parse(" 100000001")).isEmpty();     // a space
        assertThat(DemoNumber.parse("1000000000")).isEmpty();     // sequence 0000
        assertThat(DemoNumber.parse("9000000004")).isEmpty();     // the older manifest number: unknown prefix
        assertThat(DemoNumber.parse("7000000001")).isEmpty();     // unknown prefix
    }

    @Test
    void reservedPrefixesParseButAreNotBuilt() {
        for (String p : new String[] {"200000", "300000", "400000", "500000", "600000"}) {
            DemoNumber n = DemoNumber.parse(p + "0001").orElseThrow();
            assertThat(n.program().built()).as(p).isFalse();
        }
        assertThat(DemoProgram.DEFAULT.built()).isTrue();
        assertThat(DemoProgram.RED_LIGHT.built()).isTrue();
        assertThat(DemoProgram.DEFAULT.prefix()).isEqualTo("000000");
    }
}
