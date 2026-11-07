package cevoc.adapter.out.demo;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.domain.EvidenceItem;
import cevoc.domain.LookupStep;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.StepCause;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class DemoCaseFactoryTest {

    private final DemoCaseFactory factory = new DemoCaseFactory(new SampleMediaSource());

    @Test
    void everyListedCaseIsConsistentWithItsDeclaredStatuses() {
        assertThat(DemoScenarioChecks.problems(factory)).isEmpty();
    }

    @Test
    void numbersAreUniqueAndInTheirRange() {
        Set<String> seen = new HashSet<>();
        for (DemoScenario s : factory.scenarios()) {
            assertThat(seen.add(s.number())).as("duplicate " + s.number()).isTrue();
            assertThat(s.number()).hasSize(10);
            assertThat(s.program().built()).isTrue();
            assertThat(s.title()).isNotBlank();
            assertThat(s.description()).isNotBlank();
        }
        // every built program has all four kinds
        for (DemoProgram p : new DemoProgram[] {DemoProgram.DEFAULT, DemoProgram.RED_LIGHT}) {
            for (DemoNumber.Kind k : DemoNumber.Kind.values()) {
                assertThat(factory.scenarios()).anyMatch(s -> s.program() == p && s.kind() == k);
            }
        }
    }

    @Test
    void sameNumberAlwaysGivesTheSameCase() {
        for (DemoScenario s : factory.scenarios()) {
            assertThat(factory.textRecord(s)).isEqualTo(factory.textRecord(s));
            assertThat(factory.mediaSet(s)).isEqualTo(factory.mediaSet(s));
            if (s.images() > 0) {
                String name = "image-1.svg";
                assertThat(factory.mediaSource().read(s.number(), name).orElseThrow().data())
                        .isEqualTo(factory.mediaSource().read(s.number(), name).orElseThrow().data());
            }
        }
    }

    @Test
    void unlistedSequencesBehaveLikeTheFirstCaseOfTheirRange() {
        DemoScenario happy = factory.scenario("1000000042").orElseThrow();
        assertThat(happy.number()).isEqualTo("1000000042");
        assertThat(happy.title()).isEqualTo(factory.scenario("1000000001").orElseThrow().title());
        assertThat(factory.scenario("0000000150").orElseThrow().expected()).isEqualTo(factory.scenario("0000000101").orElseThrow().expected());
        assertThat(factory.scenario("1000000299").orElseThrow().expected()).isEqualTo(factory.scenario("1000000201").orElseThrow().expected());
        assertThat(factory.scenario("1000009999").orElseThrow().expected()).isEqualTo(factory.scenario("1000000301").orElseThrow().expected());
    }

    @Test
    void reservedUnknownAndMalformedNumbersAreNoCase() {
        for (String n : new String[] {"2000000001", "6000000001", "7000000001", "1000000000", "100000001", "abcdefghij", "9000000004"}) {
            assertThat(factory.scenario(n)).as(n).isEmpty();
        }
    }

    @Test
    void textAndMediaAreSeparatePayloads() {
        DemoScenario s = factory.scenario("1000000001").orElseThrow();
        DemoTextRecord text = factory.textRecord(s);
        DemoMediaSet media = factory.mediaSet(s);
        // the text record: notice fields, the flexible details map and the camera code, no media and no certificate rows
        assertThat(text.notice().offenceDescription()).containsIgnoringCase("red");
        assertThat(text.details()).containsKeys("cameraCode", "direction", "operator", "bannerLocation", "incidentNumber", "lane",
                "offenceText", "speedLimit", "timeSinceRed", "yellowLightDuration", "bannerDate", "bannerTime");
        assertThat(text.details().get("cameraCode")).isEqualTo("DEMO-RL-1");
        assertThat(text.cameraCode()).isEqualTo("DEMO-RL-1");
        // the media set: images and a video, no text fields
        assertThat(media.evidence()).extracting(EvidenceItem::kind)
                .containsExactly(EvidenceItem.Kind.IMAGE, EvidenceItem.Kind.IMAGE, EvidenceItem.Kind.IMAGE, EvidenceItem.Kind.VIDEO);
        assertThat(media.items()).allMatch(i -> i.key().startsWith("demo/1000000001/") || i.key().startsWith("samples/"));
    }

    @Test
    void theDetailsMapNeverHoldsAPlate() {
        for (DemoScenario s : factory.scenarios()) {
            String all = factory.textRecord(s).details().toString();
            assertThat(all).doesNotContain(DemoCaseFactory.PLATE);
        }
    }

    @Test
    void sampleImagesSayTheyAreSamples() {
        String svg = new String(factory.mediaSource().read("1000000001", "image-2.svg").orElseThrow().data(), StandardCharsets.UTF_8);
        assertThat(svg).startsWith("<svg").contains("FICTITIOUS DEMO DATA - NOT A REAL PHOTO").contains("1000000001");
        assertThat(factory.mediaSource().read("1000000001", "../etc.svg")).isEmpty();
        assertThat(factory.mediaSource().read("2000000001", "image-1.svg")).isEmpty();
        assertThat(factory.mediaSource().read("1000000001", "image-1.png")).isEmpty();
    }

    @Test
    void edgeValuesAreWhatTheyClaim() {
        assertThat(factory.textRecord(factory.scenario("1000000303").orElseThrow()).notice().location().length()).isBetween(250, 300);
        assertThat(factory.textRecord(factory.scenario("1000000304").orElseThrow()).notice().penaltyAmount().toPlainString()).isEqualTo("99999.99");
        assertThat(factory.scenario("1000000301").orElseThrow().offenceDate().getYear()).isEqualTo(1999);
        assertThat(factory.textRecord(factory.scenario("1000000305").orElseThrow()).details().get("timeSinceRed")).isEqualTo(0.9);
        assertThat(factory.textRecord(factory.scenario("1000000306").orElseThrow()).details().get("timeSinceRed")).isEqualTo(1.0);
        assertThat(factory.textRecord(factory.scenario("1000000307").orElseThrow()).details().get("timeSinceRed")).isEqualTo(1.1);
        assertThat(factory.scenario("1000000308").orElseThrow().offenceTime().toString()).isEqualTo("19:59");
        assertThat(factory.scenario("1000000309").orElseThrow().offenceTime().toString()).isEqualTo("20:00");
        assertThat(factory.scenario("1000000310").orElseThrow().offenceTime().toString()).isEqualTo("20:01");
    }

    @Test
    void failuresAreReportedInTheStepTraceLikeARealRoute() {
        assertThat(DemoScenarioChecks.run(factory, "1000000204", null).trace.firstFailed().step()).isEqualTo(LookupStep.READ_SUMMARY);
        assertThat(DemoScenarioChecks.run(factory, "1000000204", null).trace.firstFailed().cause()).isEqualTo(StepCause.TIMEOUT);
        assertThat(DemoScenarioChecks.run(factory, "1000000202", null).trace.firstFailed().cause()).isEqualTo(StepCause.NO_IMAGE_BYTES);
        assertThat(DemoScenarioChecks.run(factory, "1000000201", null).trace.firstFailed().step()).isEqualTo(LookupStep.CERTIFICATES);
        assertThat(DemoScenarioChecks.run(factory, "1000000201", null).trace.firstFailed().cause()).isEqualTo(StepCause.TIMEOUT);
        assertThat(DemoScenarioChecks.run(factory, "1000000205", null).details.status()).isEqualTo(PenaltyLookupResult.Status.NOT_FOUND);
        assertThat(DemoScenarioChecks.run(factory, "1000000204", null).details.status()).isEqualTo(PenaltyLookupResult.Status.UNAVAILABLE);
    }

    @Test
    void streamedPartsComeInTheUsualOrder() {
        assertThat(DemoScenarioChecks.run(factory, "1000000001", null).events)
                .containsExactly("details", "evidence", "extra", "certificates", "done");
        assertThat(DemoScenarioChecks.run(factory, "1000000203", null).events)
                .containsExactly("details", "evidence", "certificates", "done"); // details map empty: no extra part
        assertThat(DemoScenarioChecks.run(factory, "1000000202", null).events).containsExactly("details", "error");
    }
}
