package cevoc.adapter.out.demo;

import java.util.Optional;

/**
 * Where the media of a demo case comes from. Today {@link SampleMediaSource} generates simple fictitious sample images;
 * a later step plugs openly licensed media in behind this interface without touching the text record.
 */
public interface DemoMediaSource {

    /** The media for a scenario, in display order (empty when the scenario returns none). */
    DemoMediaSet mediaFor(DemoScenario scenario);

    /** The bytes of one generated object ({@code demo/<number>/<name>}), or empty when unknown. */
    Optional<Bytes> read(String number, String name);

    /** False when this source cannot supply demo content right now (a configured bundle that failed to load); demo mode is then off. */
    default boolean available() {
        return true;
    }

    record Bytes(String contentType, byte[] data) {}
}
