package cevoc.application.port.out;

/**
 * Driven port: privacy blurring of evidence video and images (ADR 0017).
 * Blurs all human faces and all vehicle plates except the offending vehicle's plate.
 * Fail-closed: if blurring fails, the video/image must not be served.
 */
public interface BlurPort {

    /** Blur a video. Returns the blurred bytes, or empty if blurring failed (fail-closed). */
    Result blurVideo(byte[] videoBytes, String offendingPlate);

    /** Blur a still image. Returns the blurred bytes, or empty if blurring failed (fail-closed). */
    Result blurImage(byte[] imageBytes, String offendingPlate);

    record Result(boolean success, byte[] data, String contentType, String detail) {
        public static Result ok(byte[] data, String contentType) {
            return new Result(true, data, contentType, null);
        }
        public static Result failed(String reason) {
            return new Result(false, null, null, reason);
        }
    }
}
