package cevoc.adapter.out.demo;

import cevoc.domain.NoticeDetails;
import java.util.Map;

/**
 * The text half of a demo case, kept apart from the media like the real flow keeps the details panel and the banner text
 * apart from the image list: the notice fields, the flexible details map (decision record 0009: camera code, direction,
 * operator, location, incident number, lane, offence, speed limit, time since red, yellow duration, date and time) and the
 * demo camera code (which decides, through {@link DemoCertificateSource}, what the certificate step finds). The map never holds a registration number.
 */
public record DemoTextRecord(NoticeDetails notice, String summary, Map<String, Object> details, String cameraCode) {

    public DemoTextRecord {
        details = details == null ? Map.of() : Map.copyOf(details);
    }
}
