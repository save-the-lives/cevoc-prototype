package cevoc.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class LookupAdapterKindTest {

    @Test
    void valuesMapToKindsCaseAndSpaceInsensitive() {
        assertThat(LookupAdapterKind.of(null)).isEqualTo(LookupAdapterKind.STUB);
        assertThat(LookupAdapterKind.of("")).isEqualTo(LookupAdapterKind.STUB);
        assertThat(LookupAdapterKind.of("stub")).isEqualTo(LookupAdapterKind.STUB);
        assertThat(LookupAdapterKind.of("browser")).isEqualTo(LookupAdapterKind.BROWSER);
        assertThat(LookupAdapterKind.of(" HTTP ")).isEqualTo(LookupAdapterKind.HTTP);
        assertThat(LookupAdapterKind.of("api")).isEqualTo(LookupAdapterKind.API);
    }

    @Test
    void retiredAndUnknownValuesAreNotAliases() {
        for (String v : new String[] {"manifest", "scraper-evidence", "revenue-nsw-http", "playwright", "nonsense"}) {
            assertThat(LookupAdapterKind.of(v)).as(v).isEqualTo(LookupAdapterKind.STUB);
        }
    }

    @Test
    void theApiAdapterIsReservedAndStopsStartUp() {
        MockEnvironment env = new MockEnvironment().withProperty(LookupAdapterKind.PROPERTY, "api");
        assertThatThrownBy(() -> new BeanConfig().penaltyLookup(env, null, null))
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("not available yet");
    }
}
