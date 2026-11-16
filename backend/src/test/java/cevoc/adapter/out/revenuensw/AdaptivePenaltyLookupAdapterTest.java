package cevoc.adapter.out.revenuensw;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.scraper.LookupDiagnostic;
import cevoc.application.port.out.LookupProgress;
import cevoc.application.port.out.PenaltyLookupPort;
import cevoc.domain.PenaltyLookupRequest;
import cevoc.domain.PenaltyLookupResult;
import cevoc.domain.PenaltyLookupResult.Status;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** Cheapest route first, and a day-long memory when the source refuses the cheap route (record 0030). Fictitious values only. */
class AdaptivePenaltyLookupAdapterTest {

    private static final PenaltyLookupRequest REQ = new PenaltyLookupRequest("9000000004", LocalDate.of(2026, 1, 15));

    /** A clock the test moves forward. */
    private static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-11-17T00:00:00Z");
        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
        void advance(Duration d) { now = now.plus(d); }
    }

    /** Answers from a queue and counts calls; a diagnostic cause can be set for an UNAVAILABLE answer. */
    private static final class Scripted implements PenaltyLookupPort {
        final Deque<Object[]> answers = new ArrayDeque<>();
        int calls;
        Scripted then(Status status, String cause) { answers.add(new Object[] {status, cause}); return this; }
        @Override public PenaltyLookupResult find(PenaltyLookupRequest r) { return find(r, LookupProgress.NONE); }
        @Override public PenaltyLookupResult find(PenaltyLookupRequest r, LookupProgress p) {
            calls++;
            Object[] a = answers.isEmpty() ? new Object[] {Status.FOUND, null} : answers.poll();
            if (a[1] != null) LookupDiagnostic.set("step=read-summary; cause=" + a[1] + "; http=403; calls=1");
            return new PenaltyLookupResult((Status) a[0], r.infringementNumber(), "", null, List.of(), "TEST");
        }
    }

    private final TestClock clock = new TestClock();
    private final Scripted http = new Scripted();
    private final Scripted browser = new Scripted();
    private final AdaptivePenaltyLookupAdapter adapter = new AdaptivePenaltyLookupAdapter(http, browser, clock);

    @AfterEach
    void clear() {
        LookupDiagnostic.clear();
    }

    @Test
    void theCheapRouteAnswersWhenItCan() {
        assertThat(adapter.find(REQ).status()).isEqualTo(Status.FOUND);
        assertThat(http.calls).isEqualTo(1);
        assertThat(browser.calls).isZero();
    }

    @Test
    void notFoundAndInputRequiredAreFinalAndNeverAskTheNextRoute() {
        http.then(Status.NOT_FOUND, null).then(Status.INPUT_REQUIRED, null);
        assertThat(adapter.find(REQ).status()).isEqualTo(Status.NOT_FOUND);
        assertThat(adapter.find(REQ).status()).isEqualTo(Status.INPUT_REQUIRED);
        assertThat(browser.calls).isZero();
    }

    @Test
    void aRefusalIsRememberedForADayThenTheCheapRouteIsTriedAgain() {
        http.then(Status.UNAVAILABLE, "blocked-403");
        adapter.find(REQ);
        assertThat(http.calls).isEqualTo(1);
        assertThat(browser.calls).isEqualTo(1);

        // For the rest of the day the cheap route is not asked at all.
        clock.advance(Duration.ofHours(23));
        adapter.find(REQ);
        adapter.find(REQ);
        assertThat(http.calls).isEqualTo(1);
        assertThat(browser.calls).isEqualTo(3);

        // After a day it is tried again, and answers.
        clock.advance(Duration.ofHours(2));
        assertThat(adapter.find(REQ).status()).isEqualTo(Status.FOUND);
        assertThat(http.calls).isEqualTo(2);
        assertThat(browser.calls).isEqualTo(3);
    }

    @Test
    void everyRefusalKindIsRemembered() {
        for (String cause : List.of("blocked-401", "blocked-429", "captcha", "bad-shape")) {
            TestClock c = new TestClock();
            Scripted h = new Scripted().then(Status.UNAVAILABLE, cause);
            Scripted b = new Scripted();
            AdaptivePenaltyLookupAdapter a = new AdaptivePenaltyLookupAdapter(h, b, c);
            a.find(REQ);
            c.advance(Duration.ofHours(1));
            a.find(REQ);
            assertThat(h.calls).as(cause).isEqualTo(1);
            assertThat(b.calls).as(cause).isEqualTo(2);
        }
    }

    @Test
    void notReadyCostsNothingSoItIsPassedOverButNeverRemembered() {
        http.then(Status.LIVE_LOOKUP_OFF, null);
        adapter.find(REQ);
        assertThat(browser.calls).isEqualTo(1);
        // The next lookup tries the cheap route again (by then the browser lookup may have taught it the service path).
        adapter.find(REQ);
        assertThat(http.calls).isEqualTo(2);
        assertThat(browser.calls).isEqualTo(1);
    }

    @Test
    void passingFaultsOnlyOpenTheShortBreaker() {
        http.then(Status.UNAVAILABLE, "timeout").then(Status.UNAVAILABLE, "timeout").then(Status.UNAVAILABLE, "network-error");
        adapter.find(REQ);
        adapter.find(REQ);
        adapter.find(REQ);
        assertThat(http.calls).isEqualTo(3);
        assertThat(browser.calls).isEqualTo(3);
        // Breaker open: straight to the browser for a while.
        adapter.find(REQ);
        assertThat(http.calls).isEqualTo(3);
        // Ten minutes later the cheap route is tried again, not a day later.
        clock.advance(Duration.ofMinutes(AdaptivePenaltyLookupAdapter.OPEN_DURATION_MINUTES + 1));
        assertThat(adapter.find(REQ).status()).isEqualTo(Status.FOUND);
        assertThat(http.calls).isEqualTo(4);
    }

    @Test
    void theCauseIsReadFromTheFixedVocabularyOnly() {
        assertThat(AdaptivePenaltyLookupAdapter.causeToken("step=x; cause=blocked-403; http=403")).isEqualTo("blocked-403");
        assertThat(AdaptivePenaltyLookupAdapter.causeToken(null)).isEqualTo("unavailable");
        assertThat(AdaptivePenaltyLookupAdapter.causeToken("no cause here")).isEqualTo("unavailable");
    }
}
