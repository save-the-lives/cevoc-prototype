package au.gov.nsw.transport.cevoc.adapter.out;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

/** Fictitious manifest only. */
class ManifestEnforcementSiteResolverTest {

    private final ManifestEnforcementSiteResolver resolver = new ManifestEnforcementSiteResolver();

    private static NoticeDetails at(String location) {
        return new NoticeDetails("x", LocalDate.of(2026, 10, 30), LocalTime.of(11, 12), location, BigDecimal.ONE,
                BigDecimal.ONE, NoticeStatus.PAYABLE, "x", EnforcementMethod.CAMERA);
    }

    @Test
    void mapsLocationTextToFictitiousCodeIgnoringCaseAndSpaces() {
        assertEquals("TEST-LOC-01", resolver.locationCodeFor(at("SAMPLE ROAD, SAMPLETOWN")).orElseThrow());
        assertEquals("TEST-LOC-01", resolver.locationCodeFor(at("  sample road,   sampletown ")).orElseThrow());
    }

    @Test
    void unknownOrMissingLocationIsEmptyNotAnError() {
        assertTrue(resolver.locationCodeFor(at("NOWHERE")).isEmpty());
        assertTrue(resolver.locationCodeFor(at(null)).isEmpty());
        assertTrue(resolver.locationCodeFor(null).isEmpty());
    }
}
