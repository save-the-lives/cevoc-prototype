package cevoc.adapter.out.blur;

import cevoc.application.port.out.BlurPort;

/**
 * Default blur adapter: fail-closed. No video or image is ever released unblurred.
 * When no blur capability is configured, this adapter is used and all video/image requests
 * get the "not available" message (ADR 0017, rule 1).
 */
public final class DenyAllBlurAdapter implements BlurPort {

    @Override
    public Result blurVideo(byte[] videoBytes, String offendingPlate) {
        return Result.failed("Blur adapter not configured (DenyAll). Video not released.");
    }

    @Override
    public Result blurImage(byte[] imageBytes, String offendingPlate) {
        return Result.failed("Blur adapter not configured (DenyAll). Image not released.");
    }
}
