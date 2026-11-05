package cevoc.adapter.out.demo;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;

/**
 * The scenario table in docs/DEMO-DATA.md and the visual check fixture are generated from the factory's list. They must be
 * up to date: when this fails, run {@code mvn -q test -Dtest=DemoArtifactsTest -Dcevoc.demo.regenerate=true} and commit.
 */
class DemoArtifactsTest {

    private static Path root() {
        return Files.exists(Path.of("docs/DEMO-DATA.md")) ? Path.of(".") : Path.of("..");
    }

    @Test
    void generatedFilesAreUpToDate() throws IOException {
        if (Boolean.getBoolean("cevoc.demo.regenerate")) {
            DemoArtifacts.write(root());
        }
        DemoCaseFactory factory = new DemoCaseFactory(new SampleMediaSource());
        String doc = Files.readString(root().resolve("docs/DEMO-DATA.md"));
        assertThat(doc).as("docs/DEMO-DATA.md is stale; regenerate").isEqualTo(DemoArtifacts.withTable(doc, DemoArtifacts.markdownTable(factory)));
        assertThat(Files.readString(root().resolve("scripts/visual-check-demo-cases.json")))
                .as("scripts/visual-check-demo-cases.json is stale; regenerate").isEqualTo(DemoArtifacts.fixtureJson(factory));
    }

    @Test
    void everyListedNumberIsInTheDocument() throws IOException {
        String doc = Files.readString(root().resolve("docs/DEMO-DATA.md"));
        for (DemoScenario s : new DemoCaseFactory(new SampleMediaSource()).scenarios()) {
            assertThat(doc).contains("`" + s.number() + "`");
        }
        for (DemoProgram p : DemoProgram.values()) {
            assertThat(doc).contains(p.prefix());
        }
    }
}
