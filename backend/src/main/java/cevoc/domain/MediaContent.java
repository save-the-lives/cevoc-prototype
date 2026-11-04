package cevoc.domain;

/** Bytes of one stored media object, for the media endpoint. Never printed. */
public record MediaContent(String contentType, byte[] data) {
    @Override
    public String toString() {
        return "MediaContent";
    }
}
