package au.gov.nsw.transport.cevoc.application.port.out;

import au.gov.nsw.transport.cevoc.domain.NoticeDetails;
import java.util.Optional;

/**
 * Driven port: penalty lookup result -> certificate page location code. Input is the lookup result's
 * {@link NoticeDetails} (location text, offence date and time). UNCONFIRMED: whether the penalty page exposes a real
 * location code or only a descriptive place name; if only a name, a maintained name-to-code table is needed from the owner.
 * Empty when the site is unknown; implementations must not throw for "not found".
 */
public interface EnforcementSiteResolver {
    Optional<String> locationCodeFor(NoticeDetails notice);
}
