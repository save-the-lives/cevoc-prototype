package cevoc.adapter.out.demo;

/** The bundle could not be trusted or read (bad checksum, wrong version, missing licence, malformed). Never carries content. */
public final class DemoBundleException extends Exception {

    public DemoBundleException(String message) {
        super(message);
    }
}
