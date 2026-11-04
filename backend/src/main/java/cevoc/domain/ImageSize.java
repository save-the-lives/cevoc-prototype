package cevoc.domain;

/**
 * Numbers only about one captured image: pixel size of the captured bytes, the size the element was rendered at
 * and the element's natural size (0 = unknown), the byte count and how the bytes were captured. A canvas capture
 * may be thumbnail resolution; comparing rendered and natural size shows whether a larger original exists.
 */
public record ImageSize(int width, int height, int renderedWidth, int renderedHeight, int naturalWidth, int naturalHeight,
                        long bytes, CapturePath path) {

    public static ImageSize unknown() {
        return new ImageSize(0, 0, 0, 0, 0, 0, 0, CapturePath.UNKNOWN);
    }

    public ImageSize withBytes(long n) {
        return new ImageSize(width, height, renderedWidth, renderedHeight, naturalWidth, naturalHeight, n, path);
    }

    public ImageSize withPixels(int w, int h) {
        return new ImageSize(w, h, renderedWidth, renderedHeight, naturalWidth, naturalHeight, bytes, path);
    }
}
