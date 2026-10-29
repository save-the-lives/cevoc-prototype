package au.gov.nsw.transport.cevoc.adapter.out.scraper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Test fake for the RenderedPageSession port. Serves FICTITIOUS saved DOM fixtures for the three states and
 * canned image bytes for blob: handles. No browser, no network.
 */
class FakeRenderedPageSession implements RenderedPageSession {

    static String fixture(String name) {
        try {
            return Files.readString(Path.of("src/test/resources/fixtures/scraper/" + name), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    String loginHtml = fixture("fictitious-state1-login.html");
    String summaryHtml = fixture("fictitious-state2-summary.html");
    String imagesHtml = fixture("fictitious-state3-images.html");
    /** The registration this fake accepts; any other value leaves the summary (plate form still present). */
    String acceptedPlate = "TST123";
    /** When set, submitLogin returns the login page again (notice not matched). */
    boolean rejectLogin;
    /** When set, submitPlate throws an IOException whose message contains the plate (to prove it is not logged). */
    boolean failOnPlate;

    final List<String> calls = new ArrayList<>();
    final List<String> loginInputs = new ArrayList<>();
    final Map<String, ImageBytes> blobs = new HashMap<>();
    boolean closed;

    FakeRenderedPageSession() {
        blobs.put("blob:https://penalty.example.invalid/00000000-0000-0000-0000-000000000001", new ImageBytes("image/jpeg", new byte[] {1, 2, 3}));
        blobs.put("blob:https://penalty.example.invalid/00000000-0000-0000-0000-000000000002", new ImageBytes("image/png", new byte[] {4, 5}));
        // 000...003 deliberately has no bytes
    }

    @Override
    public String loginPage() {
        calls.add("loginPage");
        return loginHtml;
    }

    @Override
    public String submitLogin(String noticeNumber, String offenceDate) {
        calls.add("submitLogin");
        loginInputs.add(noticeNumber + "|" + offenceDate);
        return rejectLogin ? loginHtml : summaryHtml;
    }

    @Override
    public String submitPlate(String registration) throws IOException {
        calls.add("submitPlate");
        if (failOnPlate) {
            throw new IOException("browser failed while typing " + registration);
        }
        return acceptedPlate.equals(registration) ? imagesHtml : summaryHtml;
    }

    @Override
    public Optional<ImageBytes> imageBytes(String blobUrl) {
        calls.add("imageBytes");
        return Optional.ofNullable(blobs.get(blobUrl));
    }

    @Override
    public void close() {
        closed = true;
    }
}
