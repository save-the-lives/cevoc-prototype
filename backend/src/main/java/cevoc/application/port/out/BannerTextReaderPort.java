package cevoc.application.port.out;

/**
 * Driven port: reads the text printed in the top strip of an evidence image (the camera banner is part of the picture's
 * pixels). Vendor-neutral: an adapter may use any engine that runs inside the container. Never throws: an engine that is
 * missing or fails gives a {@link Reading} with no text.
 */
public interface BannerTextReaderPort {

    /** Reads the banner strip of the given encoded image (JPEG, PNG). The image is not stored or written anywhere. */
    Reading read(byte[] image);

    /**
     * What one read produced. {@code text} is the raw engine text and must NEVER be logged or stored; everything else is
     * a count that is safe to report: pixel size, the strip height found, number of non-blank text lines.
     */
    record Reading(String text, int imageWidth, int imageHeight, int stripHeight, int lines, boolean engineFailed) {

        public static Reading failed(int imageWidth, int imageHeight, int stripHeight) {
            return new Reading("", imageWidth, imageHeight, stripHeight, 0, true);
        }

        public String text() {
            return text == null ? "" : text;
        }

        @Override
        public String toString() {
            return "Reading[" + imageWidth + "x" + imageHeight + ", strip=" + stripHeight + ", lines=" + lines + ", failed=" + engineFailed + "]";
        }
    }
}
