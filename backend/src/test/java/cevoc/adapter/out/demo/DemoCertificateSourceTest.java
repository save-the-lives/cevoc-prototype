package cevoc.adapter.out.demo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import cevoc.application.port.out.CertificateSourcePort;
import cevoc.domain.CertificateItem;
import cevoc.domain.CertificateMatch;
import cevoc.domain.CertificateQuery;
import cevoc.domain.CertificateRef;
import cevoc.domain.LookupStep;
import cevoc.domain.StepCause;
import cevoc.domain.StepOutcome;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DemoCertificateSourceTest {

    private static final LocalDate DAY = LocalDate.of(2026, 3, 14);
    private final DemoCertificateSource source = new DemoCertificateSource();
    private final DemoCaseFactory factory = new DemoCaseFactory(new SampleMediaSource());

    private static CertificateQuery wholeDay(String code) {
        return CertificateQuery.aroundOffence(code, DAY, java.time.LocalTime.of(11, 12), null);
    }

    private List<CertificateMatch> covering(String code) {
        return source.findCertificatesCovering(wholeDay(code), DAY.atTime(11, 12));
    }

    @Test
    void oneCertificateFound() {
        List<CertificateMatch> rows = covering("DEMO-RL-2");
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).covering()).isTrue();
    }

    @Test
    void severalCertificatesFoundAndOnlyTheOneInForceIsMarked() {
        List<CertificateMatch> rows = covering("DEMO-RL-1");
        assertThat(rows).hasSize(3);
        assertThat(rows.stream().filter(CertificateMatch::covering)).hasSize(1);
    }

    @Test
    void certificatesThatDoNotCoverTheOffence() {
        List<CertificateMatch> rows = covering("DEMO-CAM-3");
        assertThat(rows).isNotEmpty();
        assertThat(rows).noneMatch(CertificateMatch::covering);
    }

    @Test
    void noneFound() {
        assertThat(source.findCertificates(wholeDay("DEMO-RL-4"))).isEmpty();
        assertThat(source.findCertificates(wholeDay("DEMO-CAM-4"))).isEmpty();
    }

    @Test
    void theFailureYieldsTheTimeoutStepCause() {
        assertThatThrownBy(() -> source.findCertificates(wholeDay("DEMO-RL-5"))).isInstanceOf(RuntimeException.class)
                .satisfies(e -> assertThat(StepCause.of(e)).isEqualTo(StepCause.TIMEOUT));
    }

    @Test
    void theRowsFollowTheOffenceDayAndAMarginWindowWorksToo() {
        CertificateQuery nearMidnight = CertificateQuery.aroundOffence("DEMO-RL-2", DAY, java.time.LocalTime.of(23, 59), Duration.ofMinutes(30));
        List<CertificateRef> rows = source.findCertificates(nearMidnight);
        assertThat(rows).singleElement().satisfies(r -> assertThat(r.covers(DAY.atTime(23, 59))).isTrue());
    }

    @Test
    void onlyInventedDemoCodesAreAnswered() {
        for (String code : new String[] {"7109", "DEMO-RL-0", "DEMO-RL-6", "DEMO-RL-11", "DEMO-CAM-", "demo-rl-1", "", null}) {
            assertThat(source.handles(code)).as(String.valueOf(code)).isFalse();
            assertThat(source.findCertificates(wholeDay(code))).as(String.valueOf(code)).isEmpty();
        }
        assertThat(source.findCertificates(null)).isEmpty();
    }

    @Test
    void everyRowIsMarkedAsFictitious() {
        for (int n = 1; n <= 3; n++) {
            for (String prefix : new String[] {"DEMO-RL-", "DEMO-CAM-"}) {
                assertThat(source.findCertificates(wholeDay(prefix + n))).allSatisfy(r -> {
                    assertThat(r.description()).startsWith("Fictitious");
                    assertThat(r.documentRef()).isNull();
                });
            }
        }
    }

    @Test
    void aRedLightCaseAlwaysHasARedLightCamera() {
        for (DemoScenario s : factory.scenarios()) {
            String code = factory.textRecord(s).cameraCode();
            boolean red = s.program() == DemoProgram.RED_LIGHT && s.shape() != DemoScenario.Shape.UNKNOWN_PROGRAM_TEXT;
            assertThat(code.startsWith(DemoCameras.RED_LIGHT_PREFIX)).as(s.number()).isEqualTo(red);
            assertThat(source.handles(code)).as(s.number()).isTrue();
            Object inDetails = factory.textRecord(s).details().get("cameraCode");
            if (inDetails != null) {
                assertThat(inDetails).as(s.number()).isEqualTo(code);
            }
        }
    }

    @Test
    void theFortyThreeCasesCoverEveryOutcomeThroughTheRealLookupService() {
        assertThat(factory.scenarios()).hasSize(43);
        boolean one = false;
        boolean several = false;
        boolean none = false;
        boolean notCovering = false;
        boolean failedWithCause = false;
        for (DemoScenario s : factory.scenarios()) {
            DemoScenarioChecks.Observed o = DemoScenarioChecks.run(factory, s.number(), null);
            var cert = o.trace.entries().stream().filter(e -> e.step() == LookupStep.CERTIFICATES).findFirst();
            if (s.outcome() != DemoScenario.Outcome.FOUND) {
                continue; // not found, timeout and image failure end before step 8, exactly as for a real route
            }
            assertThat(cert).as(s.number() + " step 8 runs").isPresent();
            List<CertificateItem> items = o.certificates;
            switch (s.certs()) {
                case SINGLE -> {
                    one |= items.size() == 1 && items.get(0).coversOffence();
                    assertThat(cert.get().outcome()).isEqualTo(StepOutcome.OK);
                }
                case COVERING -> several |= items.size() >= 2 && items.stream().filter(CertificateItem::coversOffence).count() == 1;
                case NONE -> none |= items.isEmpty() && cert.get().outcome() == StepOutcome.OK;
                case NOT_COVERING -> notCovering |= !items.isEmpty() && items.stream().noneMatch(CertificateItem::coversOffence);
                case FAILED -> failedWithCause |= cert.get().outcome() == StepOutcome.FAILED && cert.get().cause() == StepCause.TIMEOUT;
            }
        }
        assertThat(List.of(one, several, none, notCovering, failedWithCause)).containsOnly(true);
    }

    @Test
    void anotherCodeGoesToTheConfiguredProviderAndADemoCodeNeverDoes() {
        List<String> asked = new ArrayList<>();
        CertificateSourcePort real = q -> {
            asked.add(q.locationCode());
            return List.of();
        };
        DemoFirstCertificateSource first = new DemoFirstCertificateSource(source, real);
        assertThat(first.findCertificates(wholeDay("7109"))).isEmpty();
        assertThat(first.findCertificates(wholeDay("DEMO-RL-1"))).hasSize(3);
        assertThat(asked).containsExactly("7109");
        assertThat(new DemoFirstCertificateSource(source, null).findCertificates(wholeDay("7109"))).isEmpty();
    }
}
