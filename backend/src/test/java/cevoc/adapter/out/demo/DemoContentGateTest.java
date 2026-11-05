package cevoc.adapter.out.demo;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.application.port.out.DemoBundleSourcePort;
import java.io.IOException;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

/** Offline: the bundle source is a fake that hands out a tiny fictitious archive or fails. Nothing is downloaded. */
class DemoContentGateTest {

    static final String URL = "https://bundle.example.test/demo.zip";
    final AtomicInteger calls = new AtomicInteger();
    final AtomicLong now = new AtomicLong(1_000);

    DemoContentGate gate(DemoBundleSourcePort source, String url, String version, String sha) {
        return new DemoContentGate(source, url, version, sha, new SampleMediaSource(), now::get, 60_000);
    }

    DemoBundleSourcePort serving(byte[] data) {
        return (location, max) -> {
            calls.incrementAndGet();
            return data;
        };
    }

    DemoBundleSourcePort failing() {
        return (location, max) -> {
            calls.incrementAndGet();
            throw new IOException("unreachable");
        };
    }

    @Test
    void noUrlMeansTheBuiltInSampleContentAndNothingIsFetched() {
        DemoContentGate g = gate(failing(), "", "", "");
        DemoCaseFactory f = new DemoCaseFactory(g);
        assertThat(g.available()).isTrue();
        assertThat(f.mediaSet(f.scenario("1000000001").orElseThrow()).items().get(0).key()).endsWith("image-1.svg");
        assertThat(g.read("1000000001", "image-1.svg")).isPresent();
        assertThat(calls.get()).isZero();
    }

    @Test
    void aVerifiedBundleIsFetchedOnFirstUseAndServed() throws Exception {
        byte[] zip = DemoBundleTest.valid();
        DemoContentGate g = gate(serving(zip), URL, "7", DemoBundleTest.sha(zip));
        assertThat(calls.get()).as("lazy: nothing fetched before first use").isZero();
        DemoCaseFactory f = new DemoCaseFactory(g);
        assertThat(f.available()).isTrue();
        assertThat(g.read("1000000001", "image-1.svg")).isPresent();
        assertThat(f.mediaSet(f.scenario("1000000001").orElseThrow()).items()).isNotEmpty();
        assertThat(calls.get()).isEqualTo(1);
    }

    @Test
    void anUnreachableBundleTurnsDemoContentOffWithoutThrowing() {
        DemoContentGate g = gate(failing(), URL, "7", "abc");
        DemoCaseFactory f = new DemoCaseFactory(g);
        assertThat(f.available()).isFalse();
        assertThat(new DemoPenaltyLookupAdapter(f).handles("1000000001")).isFalse();
        assertThat(f.mediaSet(f.scenario("1000000001").orElseThrow()).items()).isEmpty();
        assertThat(g.read("1000000001", "image-1.svg")).isEmpty();
        assertThat(new DemoCatalog(f).available()).isFalse();
        assertThat(new DemoCatalog(f).programs()).isEmpty();
    }

    @Test
    void aBadChecksumOrVersionTurnsDemoContentOff() throws Exception {
        byte[] zip = DemoBundleTest.valid();
        assertThat(gate(serving(zip), URL, "7", DemoBundleTest.sha("x".getBytes())).available()).isFalse();
        assertThat(gate(serving(zip), URL, "8", DemoBundleTest.sha(zip)).available()).isFalse();
        assertThat(gate(serving(zip), URL, "", "").available()).as("URL set but version and checksum missing").isFalse();
    }

    @Test
    void aFailureIsNotRetriedUntilTheCoolDownThenRecovers() throws Exception {
        byte[] zip = DemoBundleTest.valid();
        AtomicInteger n = new AtomicInteger();
        DemoBundleSourcePort flaky = (location, max) -> {
            if (n.getAndIncrement() == 0) {
                throw new IOException("first try fails");
            }
            return zip;
        };
        DemoContentGate g = gate(flaky, URL, "7", DemoBundleTest.sha(zip));
        assertThat(g.available()).isFalse();
        assertThat(g.available()).isFalse();
        assertThat(n.get()).as("no second attempt inside the cool-down").isEqualTo(1);
        now.addAndGet(61_000);
        assertThat(g.available()).isTrue();
        assertThat(g.available()).isTrue();
        assertThat(n.get()).isEqualTo(2);
    }
}
