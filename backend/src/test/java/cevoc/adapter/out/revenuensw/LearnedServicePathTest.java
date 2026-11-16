package cevoc.adapter.out.revenuensw;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The plain HTTP route learns where the JSON service lives from the page's own calls (record 0030). Invented segments only. */
class LearnedServicePathTest {

    @AfterEach
    void forget() {
        // Static state: never leave a learned path behind, or another test's HTTP adapter would become usable.
        LearnedServicePath.reset();
    }

    @Test
    void learnsTheSegmentOfAServiceCallOnTheApprovedHost() {
        LearnedServicePath.offer("https://api.osr.nsw.gov.au/TEST_PREFIX_AAAA/rest/api/v2/fines/token");
        assertThat(LearnedServicePath.get()).isEqualTo("TEST_PREFIX_AAAA");
    }

    @Test
    void ignoresOtherHostsPathsSchemesAndJunk() {
        LearnedServicePath.offer("https://other.example.invalid/TEST_PREFIX_AAAA/rest/api/v2/fines/token");
        LearnedServicePath.offer("http://api.osr.nsw.gov.au/TEST_PREFIX_AAAA/rest/api/v2/fines/token");
        LearnedServicePath.offer("https://api.osr.nsw.gov.au/assets/main.js");
        LearnedServicePath.offer("https://api.osr.nsw.gov.au/a/b/rest/api/v2/fines");
        LearnedServicePath.offer("not a url at all");
        LearnedServicePath.offer(null);
        assertThat(LearnedServicePath.get()).isNull();
    }

    @Test
    void aNewerSegmentReplacesTheOld() {
        LearnedServicePath.offer("https://api.osr.nsw.gov.au/TEST_PREFIX_AAAA/rest/api/v2/fines/token");
        LearnedServicePath.offer("https://api.osr.nsw.gov.au/TEST_PREFIX_BBBB/rest/api/v2/fines/summary");
        assertThat(LearnedServicePath.get()).isEqualTo("TEST_PREFIX_BBBB");
    }
}
