package cevoc.adapter.out.demo;

import cevoc.domain.EvidenceItem;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Media for demo cases taken from a verified {@link DemoBundle}: the images and the video of the media payload. The image
 * for a case is picked deterministically from the bundle's image set by sequence number, so a case always shows the same
 * pictures. The banner text of each image lives in the bundle's separate text payload ({@link DemoBundle#banner}), never in
 * the picture. Served through the demo media route under {@code demo/<number>/image-N.<ext>} and {@code video-1.<ext>}.
 */
public final class BundleMediaSource implements DemoMediaSource {

    private static final Pattern NAME = Pattern.compile("(image|video)-(\\d{1,2})\\.([a-z0-9]{2,5})");
    private final DemoBundle bundle;

    public BundleMediaSource(DemoBundle bundle) {
        this.bundle = bundle;
    }

    public DemoBundle bundle() {
        return bundle;
    }

    @Override
    public DemoMediaSet mediaFor(DemoScenario s) {
        List<DemoMediaSet.Item> items = new ArrayList<>();
        List<DemoBundle.Entry> images = bundle.media("image");
        for (int i = 1; i <= s.images() && !images.isEmpty(); i++) {
            DemoBundle.Entry e = images.get((s.sequence() + i - 1) % images.size());
            items.add(new DemoMediaSet.Item(EvidenceItem.Kind.IMAGE, "Sample camera image " + i + " (fictitious)",
                    "demo/" + s.number() + "/image-" + i + "." + ext(e.path()), e.contentType(), e.width(), e.height()));
        }
        List<DemoBundle.Entry> videos = bundle.media("video");
        if (s.video() && !videos.isEmpty()) {
            DemoBundle.Entry v = videos.get(0);
            items.add(new DemoMediaSet.Item(EvidenceItem.Kind.VIDEO, "Sample video (fictitious)",
                    "demo/" + s.number() + "/video-1." + ext(v.path()), v.contentType(), 0, 0));
        }
        return new DemoMediaSet(items);
    }

    @Override
    public Optional<Bytes> read(String number, String name) {
        Matcher m = NAME.matcher(name == null ? "" : name);
        Optional<DemoNumber> n = DemoNumber.parse(number);
        if (!m.matches() || n.isEmpty() || !n.get().program().built()) {
            return Optional.empty();
        }
        int index = Integer.parseInt(m.group(2));
        List<DemoBundle.Entry> pool = bundle.media(m.group(1));
        if (pool.isEmpty() || index < 1) {
            return Optional.empty();
        }
        DemoBundle.Entry e = m.group(1).equals("image") ? pool.get((n.get().sequence() + index - 1) % pool.size()) : pool.get(0);
        if (!ext(e.path()).equals(m.group(3))) {
            return Optional.empty();
        }
        return bundle.read(e.path()).map(b -> new Bytes(e.contentType(), b));
    }

    private static String ext(String path) {
        return path.substring(path.lastIndexOf('.') + 1).toLowerCase(java.util.Locale.ROOT);
    }
}
