package cevoc.adapter.out.demo;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** Source-level guards: one place reads the switch, the demo package makes no network call, production code holds no demo logic. */
class DemoSourceRulesTest {

    private static final Path MAIN = Files.exists(Path.of("src/main/java")) ? Path.of("src/main/java") : Path.of("backend/src/main/java");

    private static List<Path> javaFiles() throws IOException {
        try (Stream<Path> s = Files.walk(MAIN)) {
            return s.filter(p -> p.toString().endsWith(".java")).toList();
        }
    }

    @Test
    void onlyOneClassReadsTheSwitch() throws IOException {
        for (Path p : javaFiles()) {
            String text = Files.readString(p);
            boolean reads = text.contains("demo-data") || text.contains("CEVOC_DEMO_DATA");
            assertThat(reads).as(p.toString()).isEqualTo(p.getFileName().toString().equals("DemoDataConfig.java"));
        }
    }

    @Test
    void theDemoPackageMakesNoNetworkCall() throws IOException {
        for (Path p : javaFiles()) {
            if (p.toString().replace('\\', '/').contains("/adapter/out/demo/")) {
                String text = Files.readString(p);
                assertThat(text).as(p.toString()).doesNotContain("java.net").doesNotContain("HttpClient").doesNotContain("RestTemplate")
                        .doesNotContain("playwright").doesNotContain("springframework");
            }
        }
    }

    @Test
    void productionCodeOutsideTheDemoWiringDoesNotMentionDemoClasses() throws IOException {
        for (Path p : javaFiles()) {
            String path = p.toString().replace('\\', '/');
            String name = p.getFileName().toString();
            boolean allowed = path.contains("/adapter/out/demo/") || name.equals("DemoDataConfig.java") || name.equals("BeanConfig.java")
                    || name.equals("DemoController.java") || name.startsWith("DemoCatalogPort") || name.startsWith("DemoMediaPort");
            if (!allowed) {
                assertThat(Files.readString(p)).as(path).doesNotContain("cevoc.adapter.out.demo").doesNotContain("DemoCaseFactory");
            }
        }
    }
}
