package au.gov.nsw.transport.cevoc.adapter.out;

import au.gov.nsw.transport.cevoc.application.port.out.PenaltyLookupPort;
import au.gov.nsw.transport.cevoc.domain.EnforcementMethod;
import au.gov.nsw.transport.cevoc.domain.EvidenceItem;
import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import au.gov.nsw.transport.cevoc.domain.NoticeStatus;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupRequest;
import au.gov.nsw.transport.cevoc.domain.PenaltyLookupResult;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.core.io.ClassPathResource;

/**
 * Serves notices from the bundled manifest.json (fictitious test data). Returns NOT_FOUND on a miss
 * (status NOT_FOUND, never an exception) so a composing adapter can decide what to do next.
 * Licence and attribution fields in the manifest are descriptive metadata for maintainers; they are not exposed by the API yet.
 */
public class ManifestPenaltyLookupAdapter implements PenaltyLookupPort {

    static final String SOURCE = "MANIFEST";

    private final Map<String, JsonNode> byNumber = new HashMap<>();

    public ManifestPenaltyLookupAdapter() {
        this("manifest.json");
    }

    public ManifestPenaltyLookupAdapter(String classpathResource) {
        try (InputStream in = new ClassPathResource(classpathResource).getInputStream()) {
            JsonNode root = new ObjectMapper().readTree(in);
            for (JsonNode n : root.path("notices")) {
                byNumber.put(n.path("infringementNumber").asText(), n);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Cannot read " + classpathResource, e);
        }
    }

    @Override
    public PenaltyLookupResult find(PenaltyLookupRequest r) {
        String number = r.infringementNumber();
        JsonNode entry = byNumber.get(number);
        if (entry == null) {
            return new PenaltyLookupResult(PenaltyLookupResult.Status.NOT_FOUND, number,
                    "We could not match that notice number and offence date.", null, List.of(), SOURCE);
        }
        JsonNode d = entry.path("notice");
        NoticeDetails notice = new NoticeDetails(
                d.path("offenceDescription").asText(),
                r.offenceDate(),
                LocalTime.parse(d.path("offenceTime").asText()),
                d.path("location").asText(),
                new BigDecimal(d.path("penaltyAmount").asText()),
                new BigDecimal(d.path("amountOwing").asText()),
                NoticeStatus.valueOf(d.path("noticeStatus").asText()),
                d.path("statusMessage").asText(),
                EnforcementMethod.valueOf(d.path("enforcementMethod").asText()));
        List<EvidenceItem> evidence = new ArrayList<>();
        for (JsonNode e : entry.path("evidence")) {
            evidence.add(EvidenceItem.ofObject(EvidenceItem.Kind.valueOf(e.path("kind").asText()),
                    e.path("title").asText(), e.path("objectKey").asText()));
        }
        return new PenaltyLookupResult(PenaltyLookupResult.Status.FOUND, number,
                "Prototype data only.", notice, evidence, SOURCE);
    }
}
