# 0013. Privacy blurring of evidence video and still images (PROPOSED)

Status: PROPOSED. Research done, nothing built. The owner and the legal team pick before any build.
Date recorded: 2026-11-05
Owner approval: none yet. The requirement came from the owner's legal team via the owner; the recommendations below await a decision.
Paper: `docs/research/privacy-blurring.md`.

## Question
Evidence video shown to the motorist may show the offending vehicle's plate. Every human face and every other vehicle's plate must be blurred so it cannot be seen or recovered. The same question applies to still images. Upstream blurring is planned separately. Video is not available from the legacy site today (record 0007).

## Recommended (not decided)
1. Fail closed: missing, unverifiable, timed-out or failed means NOT blurred; the video is not released; the page shows the not-available message with fault wording (0007).
2. Burn-in on the server; a UI-only overlay is not accepted as a privacy control.
3. Content-based verification on every video; a manifest or signed upstream flag is only a hint. Blur only what detectors still see; never blur twice.
4. Detect once into a versioned timed region track (JSON) kept in restricted storage; merge with the clean video on the server into ONE stream; pre-render at ingest with region-only (smart) segment rendering, lazy merge only as a fallback; cache the merged output. The browser receives only the merged blurred stream; the clean video and the track are never sent to it.
5. A `BlurPort` (detect, render, verify) with swappable adapters under `adapter.out.blur`; default adapter denies everything. Per-video `RedactionStatus` maps onto the statuses in 0007.
6. Licence-safe detectors first (YuNet, MIT; an Apache-licensed plate detector). No AGPL (Ultralytics YOLO, OpenALPR) and no non-commercial weights (InsightFace) unless the owner buys a licence. Cloud detection only as an optional adapter.
7. Offending plate revealed only on a confident match (metadata plus exact plate read); otherwise blur everything.
8. One shared detect-and-verify core for video and stills, with two renderers.

## Open (see the paper, section 13)
Clip length and volume; upstream format and signalling; AGPL budget; self-host versus cloud; audio; retention; recall standard and test data approval.

## Ruled out so far
UI-only overlays as the privacy control; relying on a metadata flag alone; releasing video when blurring or verification failed; mixing clean and blurred delivery to the browser; storing the motorist's registration to decide the offending plate.

## Consequences if accepted
New ports and an adapter package; an `ArchitectureTest` rule for native libraries; a worker and queue; a restricted store for originals and tracks; an update to `docs/ARCHITECTURE.md` and the information-types section (0007). Record 0011 (video never downloadable, PDF excludes video) is unchanged.
