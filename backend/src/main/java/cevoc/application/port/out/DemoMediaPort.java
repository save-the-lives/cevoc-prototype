package cevoc.application.port.out;

import cevoc.domain.MediaContent;
import java.util.Optional;

/** Driven port: the bytes of one demo media object (a generated sample image), by case number and file name. */
public interface DemoMediaPort {
    Optional<MediaContent> read(String number, String name);
}
