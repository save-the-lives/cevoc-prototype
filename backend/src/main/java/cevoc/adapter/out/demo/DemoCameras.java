package cevoc.adapter.out.demo;

import cevoc.adapter.out.demo.DemoScenario.Certs;
import cevoc.adapter.out.demo.DemoScenario.Shape;
import java.util.Optional;

/**
 * The invented camera codes of the demo cases. A real certificate lookup is keyed by camera (enforcement site) code and a
 * date range, so the demo source is keyed the same way: the code of a demo case's camera says which sample certificate
 * outcome that camera has. Codes are clearly invented and cannot be mistaken for a real one: a red light camera is
 * {@code DEMO-RL-n}, any other demo camera is {@code DEMO-CAM-n}, with n from 1 to 5 (see {@link Certs}).
 * A red light case always has a red light camera; a case whose offence text matches no program has a generic camera.
 */
final class DemoCameras { // invented codes only

    static final String RED_LIGHT_PREFIX = "DEMO-RL-";
    static final String GENERIC_PREFIX = "DEMO-CAM-";

    /** The certificate outcome of a camera, in the order of the code's last digit (1 to 5). */
    private static final Certs[] BY_DIGIT = {Certs.COVERING, Certs.SINGLE, Certs.NOT_COVERING, Certs.NONE, Certs.FAILED};

    /** A parsed demo camera code. */
    record Camera(boolean redLight, Certs certs) {}

    private DemoCameras() {}

    /** The demo camera code of a case. */
    static String codeFor(DemoScenario s) {
        boolean red = s.program() == DemoProgram.RED_LIGHT && s.shape() != Shape.UNKNOWN_PROGRAM_TEXT;
        for (int i = 0; i < BY_DIGIT.length; i++) {
            if (BY_DIGIT[i] == s.certs()) {
                return (red ? RED_LIGHT_PREFIX : GENERIC_PREFIX) + (i + 1);
            }
        }
        throw new IllegalStateException("no camera for " + s.certs());
    }

    /** Empty unless the code is exactly one of the invented demo codes. */
    static Optional<Camera> parse(String code) {
        if (code == null) {
            return Optional.empty();
        }
        boolean red = code.startsWith(RED_LIGHT_PREFIX);
        if (!red && !code.startsWith(GENERIC_PREFIX)) {
            return Optional.empty();
        }
        String digit = code.substring(red ? RED_LIGHT_PREFIX.length() : GENERIC_PREFIX.length());
        if (digit.length() != 1 || digit.charAt(0) < '1' || digit.charAt(0) > '5') {
            return Optional.empty();
        }
        return Optional.of(new Camera(red, BY_DIGIT[digit.charAt(0) - '1']));
    }
}
