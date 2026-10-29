package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import static org.junit.jupiter.api.Assertions.assertEquals;

import au.gov.nsw.transport.cevoc.application.port.out.CertificateSourcePort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;

@SpringBootTest
class ScraperInertByDefaultTest {
    @Autowired ApplicationContext ctx;

    @Test
    void noScraperBeanUnlessEnabled() {
        assertEquals(0, ctx.getBeansOfType(CertificateSourcePort.class).size());
    }
}
