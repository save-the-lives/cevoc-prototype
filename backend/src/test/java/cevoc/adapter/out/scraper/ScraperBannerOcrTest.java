package cevoc.adapter.out.scraper;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.scraper.ScraperEvidenceTest.FakeStorage;
import cevoc.adapter.out.scraper.ScraperEvidenceTest.Sessions;
import cevoc.application.port.out.BannerTextReaderPort;
import cevoc.domain.LookupStep;
import cevoc.domain.LookupTrace;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.StepCause;
import cevoc.domain.StepOutcome;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The OCR hook in the scraper adapter, with a fake reader (no engine needed) and the fictitious fixtures. */
class ScraperBannerOcrTest {

    private static final String BASE = "https://penalty.example.invalid/customer_service/finesonline/";
    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));

    @AfterEach
    void cleanUp() {
        LookupTrace.end();
    }

    private static ScraperEvidenceLookupAdapter adapter(BannerTextReaderPort reader) {
        var settings = new ScraperSettings(true, BASE, "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), Duration.ofSeconds(60), 1_000_000);
        // The real page has no banner text (it is in the picture's pixels): take the fixture's text banner out.
        FakeRenderedPageSession fake = new FakeRenderedPageSession();
        fake.imagesHtml = fake.imagesHtml.replaceAll("(?s)<figcaption.*?</figcaption>", "");
        return new ScraperEvidenceLookupAdapter(settings, new Sessions(fake), new RevenueNswPageParser(),
                new FakeStorage(), Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC), req -> Optional.of("TST123"))
                .bannerReader(reader);
    }

    private static BannerTextReaderPort reading(String text) {
        return image -> new BannerTextReaderPort.Reading(text, 3400, 2706, 289, 5, false);
    }

    @Test
    void ocrFillsTheTwoDetailsAndTheTraceStaysClean() {
        LookupTrace t = LookupTrace.begin(false);
        PenaltyLookupResult r = adapter(reading("Speed Limit: 70 km/h Time since red: 0.4 s")).find(REQ);
        assertThat(r.details()).containsEntry("timeSinceRed", 0.4).containsEntry("speedLimit", 70);
        assertThat(t.entries().get(LookupStep.CAPTURE_IMAGES.ordinal()).cause()).isNull();
    }

    @Test
    void ocrRunsOnTheFirstImageOnlyAndOnce() {
        AtomicInteger calls = new AtomicInteger();
        adapter(image -> {
            calls.incrementAndGet();
            return new BannerTextReaderPort.Reading("", 1, 1, 1, 0, false);
        }).find(REQ);
        assertThat(calls).hasValue(1);
    }

    @Test
    void noUsableFieldIsAbsentNotAnErrorAndLeavesAWhitelistedCause() {
        LookupTrace t = LookupTrace.begin(false);
        PenaltyLookupResult r = adapter(reading("garbage ~~ ..")).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.details()).doesNotContainKeys("timeSinceRed", "speedLimit");
        assertThat(r.evidence()).isNotEmpty();
        LookupTrace.Entry e = t.entries().get(LookupStep.CAPTURE_IMAGES.ordinal());
        assertThat(e.outcome()).isEqualTo(StepOutcome.OK);
        assertThat(e.cause()).isEqualTo(StepCause.BANNER_UNREADABLE);
        assertThat(t.firstFailed()).isNull();
    }

    @Test
    void oneFieldIsEnough() {
        PenaltyLookupResult r = adapter(reading("Time since red: 0.4 s")).find(REQ);
        assertThat(r.details()).containsOnlyKeys("timeSinceRed");
    }

    @Test
    void aReaderThatThrowsNeverFailsTheLookup() {
        LookupTrace t = LookupTrace.begin(false);
        PenaltyLookupResult r = adapter(image -> {
            throw new IllegalStateException("engine exploded with TST123");
        }).find(REQ);
        assertThat(r.status()).isEqualTo(PenaltyLookupResult.Status.FOUND);
        assertThat(r.evidence()).isNotEmpty();
        assertThat(t.entries().get(LookupStep.CAPTURE_IMAGES.ordinal()).cause()).isEqualTo(StepCause.BANNER_UNREADABLE);
    }

    @Test
    void textFromThePageWinsOverOcr() {
        var settings = new ScraperSettings(true, BASE, "test-contact@example.invalid", Duration.ZERO, Duration.ofSeconds(1),
                Duration.ofSeconds(1), Duration.ofSeconds(60), 1_000_000);
        PenaltyLookupResult r = new ScraperEvidenceLookupAdapter(settings, new Sessions(new FakeRenderedPageSession()),
                new RevenueNswPageParser(), new FakeStorage(), Clock.fixed(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC),
                req -> Optional.of("TST123")).bannerReader(reading("Speed Limit: 70 km/h Time since red: 0.4 s")).find(REQ);
        assertThat(r.details()).containsEntry("speedLimit", 60).containsEntry("timeSinceRed", 1.2);
    }

    @Test
    void withoutAReaderNothingChanges() {
        LookupTrace t = LookupTrace.begin(false);
        PenaltyLookupResult r = adapter(null).find(REQ);
        assertThat(r.details()).doesNotContainKeys("timeSinceRed", "speedLimit");
        assertThat(t.entries().get(LookupStep.CAPTURE_IMAGES.ordinal()).cause()).isNull();
    }
}
