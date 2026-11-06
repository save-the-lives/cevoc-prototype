package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.demo.DemoRoute;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** The retired name CEVOC_DEMO_DATA (property cevoc.demo-data) is ignored: no fallback, no alias. */
@SpringBootTest(properties = {"cevoc.penalty-lookup.adapter=stub", "cevoc.certificates.providers=none", "cevoc.demo-data=true", "CEVOC_DEMO_DATA=true", "cevoc.demo.data=true"})
class DemoSwitchOldNameIgnoredTest {

    @Autowired ObjectProvider<DemoRoute> demo;

    @Test
    void noDemoBeanIsRegistered() {
        assertThat(demo.getIfAvailable()).isNull();
    }
}
