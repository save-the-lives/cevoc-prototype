package cevoc.adapter.out.demo;

import cevoc.domain.EvidenceItem;
import java.util.List;

/**
 * The media half of a demo case: the images and the video, as the real flow keeps them, apart from the text record.
 * Keys are object keys: {@code demo/<number>/<file>} for a generated sample image, {@code samples/<path>} for the
 * sample video that ships with the front end. A later step may add other keys behind the same {@link DemoMediaSource}.
 */
public record DemoMediaSet(List<Item> items) {

    public record Item(EvidenceItem.Kind kind, String title, String key, String contentType, int width, int height) {}

    public DemoMediaSet {
        items = List.copyOf(items);
    }

    public static DemoMediaSet empty() {
        return new DemoMediaSet(List.of());
    }

    /** The evidence list the lookup result carries (object keys; the application turns them into links). */
    public List<EvidenceItem> evidence() {
        return items.stream().map(i -> {
            EvidenceItem e = EvidenceItem.ofObject(i.kind(), i.title(), i.key());
            return i.kind() == EvidenceItem.Kind.IMAGE ? e.withSize(i.width(), i.height()) : e;
        }).toList();
    }
}
