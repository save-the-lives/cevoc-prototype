# 0017. Privacy blurring of evidence video and still images (ACCEPTED, BUILDING)

Status: ACCEPTED. Spike proven end-to-end 2026-11-10; server-side blur wired into the shared media path. ArchitectureTest rules pending.
Date recorded: 2026-11-05. Updated: 2026-11-10.
Owner approval: 2026-11-10 — blur is a core feature, always on, no toggle. Pre-blurred static files rejected ("must be rendered like live").
Paper: `docs/research/privacy-blurring.md`.
Licence note: `docs/research/blur-pipeline-licences.md` — every component's licence, implications for a public TfNSW service, and open questions for legal.

## Question
Evidence video shown to the motorist may show the offending vehicle's plate. Every human face and every other vehicle's plate must be blurred so it cannot be seen or recovered. The same question applies to still images. Upstream blurring is planned separately. Video is not available from the legacy site today (record 0007).

## Recommended (not decided)
1. Fail closed: missing, unverifiable, timed-out or failed means NOT blurred; the video is not released; the page shows the not-available message with fault wording (0007).
2. Burn-in on the server; a UI-only overlay is not accepted as a privacy control.
3. Content-based verification on every video; a manifest or signed upstream flag is only a hint. Blur only what detectors still see; never blur twice.
4. Detect once into a versioned timed region track (JSON) kept in restricted storage; merge with the clean video on the server into ONE stream; pre-render at ingest with region-only (smart) segment rendering, lazy merge only as a fallback; cache the merged output. The browser receives only the merged blurred stream; the clean video and the track are never sent to it.
5. A `BlurPort` (detect, render, verify) with swappable adapters under `adapter.out.blur`; default adapter denies everything. Per-video `RedactionStatus` maps onto the statuses in 0007.
6. Licence-safe detectors first (YuNet, MIT; an Apache-licensed plate detector). No AGPL (Ultralytics YOLO, OpenALPR) and no non-commercial weights (InsightFace) unless the owner buys a licence. Cloud detection only as an optional adapter. **Update 2026-11-10:** Owner accepted AGPL YOLOv8n for the prototype to get blur working; licence decision deferred to productionisation (see `docs/research/blur-pipeline-licences.md`).
7. Offending plate revealed only on a confident match (metadata plus exact plate read); otherwise blur everything.
8. One shared detect-and-verify core for video and stills, with two renderers.

## Open (see the paper, section 13)
Clip length and volume; upstream format and signalling; AGPL budget; self-host versus cloud; audio; retention; recall standard and test data approval.

## Ruled out so far
UI-only overlays as the privacy control; relying on a metadata flag alone; releasing video when blurring or verification failed; mixing clean and blurred delivery to the browser; storing the motorist's registration to decide the offending plate.

## Decision: Python for the detection and rendering pipeline (2026-11-10)

The blur pipeline runs in Python (subprocess via `ProcessBlurAdapter`), not JavaCV or a Java-native implementation. Reasons:

1. **ML ecosystem is Python-first.** YuNet, YOLO, MediaPipe, HuggingFace, ONNX Zoo — every face/plate detector ships Python bindings first. Java wrappers arrive months later or not at all. Swapping to a better model means changing one Python file, not a Java rewrite.
2. **Fine-tuning and training.** If we train a plate detector on Australian plates (likely the real answer for production, see research paper section 4.2), that work is PyTorch/TensorFlow — both Python. The trained model exports to ONNX, but the training pipeline and evaluation tooling are Python.
3. **GPU acceleration.** CUDA, TensorRT, and OpenVINO integrations are Python-native. Java wrappers for GPU inference lag behind.
4. **ONNX Runtime parity.** Python gets new operators and optimisers before the Java binding.
5. **Community and support.** Every detection tutorial, benchmark, pretrained weight, and recall evaluation tool is Python.

The trade-off is ~400 MB of Python dependencies in the Docker image (Python, pip, OpenCV, numpy, pytesseract). This is a one-time build cost; the runtime cost is a subprocess per video (cached by content hash after the first run).

The `BlurPort` interface in the Java application layer is language-agnostic — `ProcessBlurAdapter` calls Python, but a future `JavaCvBlurAdapter` or `CloudBlurAdapter` could replace it without touching the application or web layers. The hexagonal boundary is clean (record 0001).

Ruled out: JavaCV for the detection layer. Same OpenCV underneath, but model availability, GPU tooling, and the fine-tuning path all favour Python. JavaCV remains an option for a future adapter if the Python dependency becomes a deployment constraint (e.g. a serverless target with strict image size limits).

## What is built (2026-11-10)

- `BlurPort` interface in `application.port.out` — `blurVideo(bytes, offendingPlate)`, `blurImage(bytes, offendingPlate)`, fail-closed `Result`.
- `ProcessBlurAdapter` in `adapter.out.blur` — calls Python scripts as subprocess, caches by SHA-256. Cache is in-memory with no TTL (lives until container restart). **TODO:** align cache retention with evidence link expiry (currently 20 min in `InMemoryMediaAdapter`) and add a size bound.
- `DenyAllBlurAdapter` — default when no pipeline is available; never releases video.
- `StreamingBlurAdapter` — HLS segment-by-segment blur, built but not enabled (set `CEVOC_BLUR_STREAMING=true`).
- `MediaController` applies blur to every video and image before serving — single blur point for both live and demo paths.
- `OffendingPlateContext` — thread-local per request; the plate is never logged or stored.
- Python pipeline in `backend/blur-pipeline/`: `detect_faces.py` (YuNet), `detect_plates.py` (contour + tesseract OCR), `render_blur.py` (OpenCV frame-by-frame), `merge_tracks.py`, `yunet.onnx` model (232 KB, MIT).
- Dockerfile installs Python, OpenCV, pytesseract, numpy in the container image.
- Fail-closed error: HTTP 451 with "This image/video could not be prepared for safe viewing."

## Consequences
New ports and an adapter package; an `ArchitectureTest` rule for native libraries (pending); Python in the Docker image; a worker and queue for production volume (not yet built); a restricted store for originals and tracks (not yet built); an update to `docs/ARCHITECTURE.md` and the information-types section (0007). Record 0011 (video never downloadable, PDF excludes video) is unchanged.
