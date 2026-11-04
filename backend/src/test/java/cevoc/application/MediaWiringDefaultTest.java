package cevoc.application;

import static org.assertj.core.api.Assertions.assertThat;

import cevoc.adapter.out.memory.InMemoryMediaAdapter;
import cevoc.adapter.out.stub.StubMediaAdapter;
import cevoc.application.port.out.MediaReadPort;
import cevoc.application.port.out.MediaStoragePort;
import cevoc.application.port.out.SignedLinkPort;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** Which storage fills the media ports, by configuration. The scraper itself stays off (enabled=false by default). */
@SpringBootTest
class MediaWiringDefaultTest {
    @Autowired MediaStoragePort storage;
    @Autowired SignedLinkPort links;
    @Autowired org.springframework.beans.factory.ObjectProvider<MediaReadPort> read;

    @Test
    void theDefaultIsTheStubWithNoReadPort() {
        assertThat(storage).isInstanceOf(StubMediaAdapter.class);
        assertThat(links).isSameAs(storage);
        assertThat(read.getIfAvailable()).isNull();
    }
}
