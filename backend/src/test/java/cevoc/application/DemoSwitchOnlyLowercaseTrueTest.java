package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.demo.DemoRoute;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Only the lowercase word true turns demo data on; TRUE and 1 do not. */
@SpringBootTest(properties = "cevoc.demo-data.enabled=TRUE")
class DemoSwitchOnlyLowercaseTrueTest {

    @Autowired ObjectProvider<DemoRoute> demo;

    @Test
    void noDemoBeanIsRegistered() {
        assertThat(demo.getIfAvailable()).isNull();
    }
}
