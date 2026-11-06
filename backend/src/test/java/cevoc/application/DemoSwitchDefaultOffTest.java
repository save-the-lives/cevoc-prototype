package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.demo.DemoRoute;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** No setting at all: demo data is OFF by default. */
@SpringBootTest(properties = {"cevoc.penalty-lookup.adapter=stub", "cevoc.certificates.providers=none"})
class DemoSwitchDefaultOffTest {

    @Autowired ObjectProvider<DemoRoute> demo;

    @Test
    void noDemoBeanIsRegistered() {
        assertThat(demo.getIfAvailable()).isNull();
    }
}
