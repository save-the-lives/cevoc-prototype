# Privacy blurring of evidence video and still images (research paper, design ahead of the source)

Status: RESEARCH and PROPOSAL. Nothing is built. No real video, image, plate or person was used. All values in this paper are fictitious.
Date: 2026-11-05. Decision record stub: `docs/decisions/0017-privacy-blurring-of-evidence-media.md` (PROPOSED).
Related: `docs/ARCHITECTURE.md`, records 0001 (hexagonal), 0002 and 0008 (vendor neutrality), 0005 (public data only), 0007 (information types, status, transparency rule), 0011 (evidence pack).

Proof words: PROVEN = read in this repository's docs, or in the cited source on 2026-11-05, or tested. INFERRED = reasoned, from general knowledge or from the sources, not checked. Where a source page did not state a figure, this paper says so rather than filling it in.

## 1. Executive summary and recommendation

The requirement (from the owner's legal team): in evidence video shown to the motorist, the offending vehicle's plate may be shown; every human face and every other vehicle's plate must be blurred so it cannot be seen or recovered. Video is not available from the legacy site today (PROVEN, record 0007: `VIDEO` is a placeholder type), so this is design ahead of the real source. Separate planned upstream work will blur during adjudication.

Recommendation, in order of importance:

1. **Fail closed.** The browser only ever receives a stream that CEVOC has verified as blurred. Missing, unverifiable, timed-out or failed means NOT blurred, and the video is not released. The page shows the existing "not available" message under the transparency rule (0007), worded as a fault, not a choice.
2. **Burn in on the server; never rely on a UI overlay.** A UI-only overlay still delivers the unblurred video to the browser, where anyone can extract it (INFERRED, but it is how browsers work: the bytes are in the page's network responses). It fails the "cannot be recovered" test.
3. **Verify by content, use metadata only as a hint.** Every video is checked by running the detectors on the delivered output. Any detection above the threshold means "not yet blurred" for that region. A manifest or signed upstream flag may say "expected already blurred", which routes the video and raises an alarm if the content check disagrees, but it never replaces the content check. Blur only what the detectors still see, so already-blurred regions are not blurred twice.
4. **Detect once, store a timed region track, merge on the server (the owner's speed idea).** Detection (the expensive step) runs once and produces a versioned JSON track of blur regions. A separate cheap step merges the clean video and the track into one blurred stream. The track is never sent to the browser.
5. **Recommended SPEED approach.** Pre-render a blurred HLS rendition at ingest, off the playback path, using region-only (smart) rendering: re-encode only the segments that contain regions, stream-copy the others, with encoder settings matched so segments splice cleanly. Playback is then ordinary playback of a finished file, so it is not slowed at all. On-demand per-segment merging with a cache is the fallback for first access (a "preparing" state), not the main path. Honest caveat (INFERRED): road scenes usually have other vehicles in nearly every segment, so many segments will need re-encoding; the saving from copy segments may be small, and the measurement plan in section 8 decides whether the complexity is worth it. For typical short clips a plain pre-render is probably fast enough (section 8).
6. **Detectors, licence-safe first.** Faces: YuNet (MIT, runs in OpenCV) as the primary, with a second detector for recall (see section 3). Plates: a detector we can legally ship, not Ultralytics YOLO under AGPL unless the owner buys the enterprise licence, and not the SCRFD or RetinaFace pretrained weights (non-commercial). Plate reading (OCR) is only needed to find the offending plate. Cloud detection services stay optional adapters (vendor neutrality, data sovereignty).
7. **Offending plate: reveal only on a confident match, otherwise blur it too.** Match by program evidence metadata first (which track is the offending vehicle) and corroborate with a plate read against the notice registration. A near match is not a match. The safe failure is that the motorist's own plate is blurred, never that another vehicle's plate is shown.
8. **One capability serves video and stills.** A shared detect-and-verify core, two renderers (image and video). Stills are simpler (no tracking) but have their own leaks (embedded thumbnails, metadata).
9. **Assure it.** A labelled test set, recall targets set by legal, human sampling, and an audit log with no personal data.

Summary line for the speed addendum: detect once into a versioned region track, merge with clean video on the server into one stream, pre-render at ingest with smart segment rendering, cache the result, and send the browser only the merged stream, never the clean video and never the track.

## 2. Terms and assumptions

- "Region": a rectangle (optionally an ellipse or polygon) in frame coordinates, a time span, and a label (`FACE`, `PLATE`, `PLATE_OFFENDING_KEEP`).
- "Track": the list of regions for one video, with time, position and size per frame or per keyframe with interpolation.
- "Upstream": the separate planned blurring work during adjudication. Its output format, timing and signalling are unknown (open question).
- Typical clip length is unknown (open question). Numbers below use 10, 30 and 60 second examples at 25 fps, 1080p, as illustrations only (INFERRED).
- Evidence images today are about 1.4 MB at full size, 3 to 6 per notice (PROVEN, record 0011 estimate).
- The registration the motorist enters is request-scoped and must not be stored or logged (PROVEN, 0010 and 0011). Any design that needs it later must not break that rule (see section 6).

## 3. Where to blur

| Choice | Privacy strength | Cost, latency | Verdict |
|---|---|---|---|
| UI-only overlay (CSS box, canvas, VTT cue drawn over a clean video) | Weak. The clean video reaches the browser. It can be extracted from the network tab, a saved file or a screen capture of the underlying stream. Also a DVD-style player-composited overlay is exactly this model (INFERRED). | Cheapest | Reject as a privacy control. Acceptable only as a preview inside an access-restricted review tool. |
| Server-side burn-in at request time | Strong, if the merged stream is the only output | Adds latency at first byte; load spikes with viewers | Fallback path |
| Server-side burn-in at ingest, cached rendition | Strong | Work done once, off the playback path; storage for one extra rendition | Recommended |
| Pre-process in the source system (upstream) | Strong if verified | None for CEVOC beyond verification | Preferred when present and verified (section 5) |

Retention (INFERRED, legal question): if law requires the original to be kept, keep it in separate restricted storage, encrypted, with no signed link ever issued to the public API, and a separate access role for the processing worker and for authorised staff. The public API can only hand out links to the blurred rendition. The evidence-pack PDF excludes video (PROVEN, record 0011 rule 2).

Caching and cost of burn-in at ingest (INFERRED, to be measured): one extra rendition per video, roughly the size of the original. The rendition holds the offending vehicle's plate, so it has the same access and expiry rules as the evidence images (the existing retention window and signed expiring links, 0011).

What must not leak besides the main picture (checklist, INFERRED, all to be tested):
- The audio track (voices, spoken plates). Default: remove the audio entirely unless legal says otherwise.
- Poster frames, thumbnails and seek-preview sprites generated from the clean video.
- Other streams in the container: subtitles, data tracks, cover art, GPS or device metadata.
- The region track itself, which says where people and plates were (and for the offending vehicle, which one is exempt).
- Intermediate files and temp files on disk, error logs containing frames, crash dumps.
- Caches (CDN, browser) holding an earlier clean version if a video was released and then re-processed.

Irreversibility of the blur (INFERRED, widely discussed in the research literature on mosaic and blur reversal, not read for this paper): light pixelation or a mild Gaussian blur with known parameters can sometimes be partly reversed or leave enough to identify. Use a solid opaque fill or a very heavy blur over a padded region, applied to the decoded pixels before encoding. Test with a deblurring attempt in the spike.

## 4. Options compared

Columns: accuracy on small, fast, night and motion-blurred subjects; recall versus false positives (recall matters most, so thresholds are set low and false positives are accepted); CPU versus GPU; licence; maintenance; fit as an adapter; how to test.

### 4.1 Face detection

| Option | Licence | Accuracy and recall notes | Speed | Maintenance | Fit as adapter | Test |
|---|---|---|---|---|---|---|
| **YuNet** (OpenCV Zoo, `FaceDetectorYN`) | MIT (PROVEN, [opencv_zoo README](https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md)). OpenCV itself is Apache 2 from 4.5 (PROVEN, [opencv.org/license](https://opencv.org/license/)). | WIDER FACE AP 0.834/0.824/0.708 (easy/medium/hard) in the intro, a table on the same page lists 0.8844/0.8656/0.7503; trained for faces roughly 10x10 to 300x300 pixels; dynamic input shape in the 2026 model (all PROVEN, same page; the page's own numbers disagree). Night, motion blur and faces behind a windscreen: no figure (INFERRED: weak). | Page gives no timings; described as light-weight (PROVEN). On CPU INFERRED to be tens of ms per frame at video resolution, to measure. | Active (a 2026 model release is listed) | Very good: ONNX, runs in OpenCV (JavaCV) or ONNX Runtime | Labelled set, section 9 |
| **SCRFD** (InsightFace) | Code MIT, but the pretrained models and training data are "for non-commercial research purposes only" (PROVEN, [InsightFace README](https://github.com/thienpn/insightface); the page was a fork, check upstream) | Strong on small faces in the literature (INFERRED) | Efficient (PROVEN, per README) | Active upstream (INFERRED) | Fine technically | **Do not ship the weights.** Only usable if we train our own on licensed data. |
| **RetinaFace** | Depends on the implementation and the weights; the InsightFace weights carry the same non-commercial terms (PROVEN for those) | Good on small faces (INFERRED) | Heavier than YuNet (INFERRED) | Mixed | Fine technically | Check each repo's weight licence before use |
| **MediaPipe BlazeFace** | Code samples Apache 2.0; the page does not state the model licence, see the model cards (PROVEN, [Google page](https://developers.google.com/edge/mediapipe/solutions/vision/face_detector)) | Short range model is for selfie-like close faces; full range is for wider scenes; all use 128x128 input (PROVEN). A 128 px input makes small faces in a 1080p frame hard (INFERRED); needs tiling. | Pixel 6 CPU 2.94 ms, GPU 7.41 ms for the short-range model (PROVEN, same page) | Active | OK | Compare against YuNet on tiled input |
| **Haar cascades** (OpenCV) | Apache 2 / BSD with OpenCV | Frontal faces only, many false positives, poor on motion and night (INFERRED) | Fast | Legacy | Trivial | Use only as a baseline/ablation and as a cheap secondary vote; not as the primary |
| **Cloud face detection** (for example Amazon Rekognition video face detection) | Commercial service | No figures read. Returns boxes, not blurred video (INFERRED) | n/a | Vendor | Detection adapter only | See 4.5 |

Recommended: YuNet as primary at a low threshold, run on upscaled crops/tiles for small faces, plus a second independent detector (for example BlazeFace full range, if its model licence is acceptable, or a Haar vote) so that a miss by one is caught by the other. Union of the detections. Windscreen faces at night will remain the hardest case (INFERRED); if a human reviewer cannot see a face at normal playback it is a legal question whether it needs blurring (section 10).

### 4.2 Plate detection and OCR

| Option | Licence | Notes | Fit |
|---|---|---|---|
| **Ultralytics YOLO** (v5/v8/11 and later, including plate models built on them) | AGPL-3.0, or a paid Enterprise Licence for proprietary or SaaS use. The vendor states hosting it behind an API does not avoid AGPL (PROVEN, [ultralytics.com/license](https://ultralytics.com/license)). | Fast and accurate (INFERRED). Fine-tuned weights fall under AGPL by default (PROVEN, same page). | Excluded by default. Include only if the owner buys the enterprise licence; legal decision. |
| **YOLOX** (Megvii) | Apache-2.0 (PROVEN, [repo](https://github.com/Megvii-BaseDetection/YOLOX)). Nano 25.8 mAP, Tiny 32.8 mAP at 416 input; ONNX and OpenVINO demos (PROVEN). | Needs training or fine-tuning on plate data we may use. | Good fit, licence-safe. |
| **FastALPR / open-image-models / fast-plate-ocr** | FastALPR repository MIT (PROVEN, [repo](https://github.com/ankandrew/fast-alpr)). Licences of the default detector and OCR models are not stated on that page (PROVEN: unknown). ONNX Runtime, CPU, CUDA, OpenVINO (PROVEN). | No speed or accuracy figures on the page. Trained for what plate styles is unknown (INFERRED: probably not tuned to Australian plates). | Good candidate for a spike; confirm model licences first. |
| **OpenALPR** | Dual: AGPL open source and proprietary (PROVEN, [Wikipedia](https://en.wikipedia.org/wiki/OpenALPR)); last stable release shown is 2.5.103 from March 2018 (PROVEN, same page) | Old, stale | Not recommended. |
| **Train our own plate detector** on licensed or synthetic plates | Our choice | Many plates are small, angled, dirty, IR-saturated at night (INFERRED). Data licensing is the hard part. Candidate backbone: YOLOX (Apache). | Likely the real answer for production; plan a data source with legal. |
| **Text-detection style cloud APIs** | Commercial | Plates as text may be found by general text detection (INFERRED) | Optional cross-check adapter. |

For blurring, plate DETECTION is what matters (recall). OCR is only needed for the offending-plate match (section 6). Do not run OCR on every plate and keep the results; read and discard.

### 4.3 Tracking across frames

| Option | Licence | Notes |
|---|---|---|
| **ByteTrack** | MIT per the repo page (PROVEN, [repo](https://github.com/FoundationVision/ByteTrack)). It associates low-score boxes too, which suits a recall-first design. 30 FPS on a V100 including its detector (PROVEN, same page). |
| **SORT** | Check the repo licence before use; reported as GPL-3 (INFERRED). Re-implementing a Kalman filter plus IoU matching is small and avoids it. |
| **Own simple tracker** (IoU/Kalman plus bidirectional smoothing) | Ours. Because processing is offline we can run forward and backward over the whole clip, which a live system cannot (INFERRED, but is a real advantage). |

Design rules for the region track (all INFERRED, to test):
- Pad every box generously (for example 20 to 40 percent) and grow the padding with the box's apparent speed.
- Hold a region after the last detection for N frames (hysteresis) and back-fill before the first detection by extrapolation, because the object was almost certainly present before it was first detected.
- Fill gaps between detections of the same track; never interpolate across a long gap without a detection check.
- A detection at a fresh position that has no track starts a new region at once (do not wait for confirmation).
- Smooth positions only for appearance; the blur box is the union of the smoothed box and the raw detections.

### 4.4 Video processing

| Option | Licence | Notes |
|---|---|---|
| **FFmpeg as a subprocess in a container** | LGPL 2.1+ with optional GPL parts; building with `--enable-gpl` makes the GPL apply to all of it, and the legal page also warns about patents on H.264 and similar codecs (PROVEN, [ffmpeg.org/legal](https://ffmpeg.org/legal.html)). x264 is GPL (PROVEN, same page). | Simplest for filtergraph use, hardware encoders, and HLS output. Clear process boundary. Whether an agency "distributes" the container image (GPL source obligations) is a legal question (INFERRED). |
| **JavaCV (FFmpeg and OpenCV bindings)** | The page does not state the licence; it offers an optional `ffmpeg-platform-gpl` artifact for GPL builds (PROVEN, [repo](https://github.com/bytedeco/javacv)). | In-process frame loop (decode, modify the OpenCV `Mat`, encode). Easiest to write track-driven masks. Adds native libraries to the Java process (memory, crash isolation: INFERRED concern). |
| **GStreamer** | LGPL (INFERRED) | Powerful pipelines, steeper learning curve. Not preferred. |
| **Hardware encoders** (NVENC, VAAPI) | Driver/vendor | NVENC is a dedicated encoder, independent of CUDA cores, supports H.264, HEVC and AV1 (PROVEN, [NVIDIA guide](https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvenc-video-encoder-api-prog-guide/index.html)). VAAPI for Intel/AMD (INFERRED). |

Recommendation: an out-of-process worker (container) running FFmpeg built to the LGPL configuration where possible plus a hardware encoder where available, driven by the Java adapter; JavaCV in-process is an acceptable alternative adapter for the spike. Both sit behind the same port, so the choice is reversible (record 0001).

### 4.5 Managed cloud services (for example AWS Rekognition)

- Pricing shape: examples on the AWS page show stored-video analysis at $0.05 to $0.10 per minute for some APIs and $0.0010 per image for the first million images; free tier 1,000 images and 60 video minutes a month for 12 months. The full table did not load, so face detection per-minute pricing was not read (PROVEN for the examples, [AWS pricing](https://aws.amazon.com/rekognition/pricing/)).
- The page does not mention face blurring (PROVEN). These services return boxes (INFERRED), so CEVOC would still have to burn in.
- Vendor neutrality (record 0002): AWS is the real target, but the core must not depend on it, so a cloud detector may only be an optional adapter behind the detection port. AWS Rekognition was announced in the Sydney region in 2018 (PROVEN by the title of the [announcement](https://aws.amazon.com/de/about-aws/whats-new/2018/02/amazon-rekognition-now-available-in-aws-asia-pacific-tokyo-and-asia-pacific-sydney-regions/)).
- Data sovereignty and privacy (INFERRED, legal question): sending unblurred evidence video of third parties to a vendor is itself a disclosure. It needs lawful basis, a region setting, a contract on retention and training use, and an opt-out of service-improvement use. Prefer self-hosted detection for the unblurred originals; consider a cloud service only for a second opinion on already-blurred output (the verification step), which carries far less risk.

## 5. Upstream blurring: detect, do not blur twice, blur what is left

Question: how do we know whether upstream has already blurred?

| Method | Strength | Weakness |
|---|---|---|
| Metadata flag (a field in the program evidence metadata) | Free, instant | Anyone or any bug can set it. Says nothing about what the pixels contain. Not trustworthy alone. |
| Signed flag / signed manifest (a signature over the file hash, the blur tool name and version, the date, and the claim "all faces and non-offending plates blurred") | Proves who made the claim and that the file is the one the claim covers | Proves the claim, not the pixels. A buggy upstream signs bad output. Needs key management. |
| Region track delivered by upstream (their track, our renderer) | Reuses detection, enables our own merge | Quality unknown; version and format coupling |
| Content-based verification (run our detectors on the output; any detection above the threshold means not yet blurred) | Checks the thing that matters, the pixels. Independent of upstream's tooling. | Cost of one detection pass; can miss what our detector cannot see; its threshold trades false alarms for recall |

Recommended combination (INFERRED design, to prove in the spike):

1. **Content verification is mandatory for every video**, upstream flag or not. It is the only gate that can release a video.
2. A signed manifest, when present and valid, is a hint. It selects the "verify only" route and is compared with the content result. A valid signed claim plus a failed content check raises an alert to the upstream owner and the video is treated as not blurred for that region. An invalid or absent signature does not block the pipeline; it just means the full route.
3. Route:
   - Verification finds nothing above threshold: release as is (upstream blurring accepted). No second blur, so no double blur.
   - Verification finds regions: add only those regions to the track and burn them in (blur what is still visible), then verify again.
   - Verification cannot run, times out, or the source file is missing or unreadable: NOT blurred, do not release.
4. Already-blurred regions do not trigger detectors if the blur is heavy enough. This is INFERRED and is a test item: an upstream blur light enough to leave detectable faces is, by the same token, a blur we should add to.
5. Use a stricter threshold for verification than for the original detection pass (lower confidence cut, more tiles, every frame), because the verifier is the last line.
6. The verifier should ideally be a different detector than the one used for the first pass, to avoid a shared blind spot (INFERRED).

Note: an exempt offending plate must not trigger a "not blurred" failure: the verifier masks the offending-plate region from consideration only when the offending-vehicle decision (section 6) is confident; otherwise that plate counts as a detection and gets blurred.

## 6. Identifying the offending plate

- Primary signal: program evidence metadata that identifies the offending vehicle (for example the capture frame and its bounding box, or the lane), if the program provides one (open question; the fixtures in this repository do not model it, INFERRED).
- Secondary signal: read candidate plates (OCR) on the offending vehicle's track and compare with the notice's registration, after normalising case, spaces and hyphens. Use per-character confidence and a majority over many frames.
- Mismatch risks (INFERRED): confusable characters (0/O, 8/B, 1/I), partial reads, a nearby vehicle with a similar plate, a plate-like sign, a misattributed track, a notice that lists the registration slightly differently from the plate. A near match must be treated as no match.
- Decision rule: reveal a plate only if (a) the track's identity agrees with the metadata or the track is clearly the same vehicle throughout, and (b) the normalised read equals the notice registration exactly with high confidence over several frames, and (c) the decision is recorded as a boolean per video in the audit log (not the plate). Anything else: blur every plate, including the offending one. Safe default: blur everything not confidently matched.
- Privacy of the registration: the motorist's input is request-scoped and not stored (PROVEN, 0010 and 0011). The reveal decision should therefore be made once at ingest, from the notice record held by the program, and baked into the cached rendition, so any entitled viewer gets the same file and no registration is kept (design choice; open question whether the program record is available at ingest).
- The offending driver's face is also a human face: it must be blurred (requirement: every face).
- Consequence of the safe default: sometimes a motorist will see their own plate blurred. That costs usefulness but never leaks. A "plate hidden for safety" note and the reference to the evidence images (where the plate is shown) mitigates it. The image set may already show the plate (PROVEN, the legacy site shows plate images; exact content INFERRED).

## 7. Still images: what changes, and does one capability serve both

Differences:
- No time axis, so no tracking, no hysteresis, no interpolation. A miss in one frame is the whole miss, so a second detector and tiling matter more.
- More pixels per object at full size (about 1.4 MB images, PROVEN estimate in 0011), so small faces and plates are more detectable than in compressed video (INFERRED).
- Leaks specific to images: embedded EXIF thumbnails and previews, maker notes, GPS, and variants. The media endpoint makes smaller copies from the full image (PROVEN, record 0010 "not built": the endpoint makes the smaller copies as for the Chromium route). Thumbnail and medium sizes must be derived from the blurred image, never from the original. The image download and the evidence-pack PDF (0011) must also use the blurred bytes only.
- Plate close-ups of the offending vehicle are normal legacy evidence (INFERRED). The offending-plate rule in section 6 applies per image.

The timed-track idea for stills: a per-image list of regions (no time) stored as JSON next to the image, applied on delivery by a fast compositor. It is cheap (milliseconds, INFERRED), it supports re-blurring with new regions without a re-detect, and it suits caching of the final blurred bytes. The security rule is the same: only the composited bytes leave the server; the clean image and the region list never go to the browser.

One capability or two? One bounded capability with a shared core: `RegionDetectorPort` (frames or images in, regions out), the decision logic (offending plate, padding, thresholds), the verifier, and the status model are shared. Only the renderers differ (image renderer, video renderer). So: one set of detectors, one verification concept, one status vocabulary, two renderers.

## 8. SPEED AND ARCHITECTURE ADDENDUM: detect once, merge on the server

The owner does not want a simple blur that re-renders the whole video and slows playback. The DVD-like idea is to detect once, store blur regions as a separate timed track (time, position, size per frame or keyframe with interpolation, keyed to what it covers), and have the CEVOC backend merge the clean video and the track into one stream on the fly, without a full re-encode where possible.

Two honest remarks first (INFERRED):
- A DVD subpicture is composited by the player. In a browser that is the UI-only overlay of section 3 and fails the privacy requirement. The server-side analogue is a merge that bakes the regions into the pixels. A pixel change inside a region cannot be done in a compressed stream without decoding and re-encoding the pictures that contain it; there is no true "overlay at the bitstream level" for H.264 or similar. So "without a full re-encode" can only mean re-encoding just the segments or groups of pictures that contain regions (smart rendering), and copying the rest.
- The speed worry is about playback. A rendition made before the viewer asks has no playback cost at all. The real question is only how long ingest takes and how fresh the result must be.

### 8.1 Security rule (stated clearly)

- The browser receives ONLY the already-merged, blurred stream (one stream). The clean video and the blur track must NEVER both go to the browser; in fact neither goes to the browser.
- The clean original stays in access-restricted storage with no public signed link and no CDN origin pointing at it.
- If detection, merge or verification fails or times out, the video is not released and the page shows the not-available message (technical-fault wording, 0007).
- Mixed delivery is out: do not serve a manifest that mixes clean "copy" segments with blurred segments unless the track and the verifier have said those clean segments contain no regions. A copy segment is clean pixels; its safety rests on the track's recall, so the verifier must run on the final manifest's content (all segments), not on the track.

### 8.2 Comparison

**(a) Ingest pre-render of a blurred rendition versus on-demand blur while streaming**

| | Ingest pre-render | On-demand while streaming |
|---|---|---|
| Playback speed | Normal; ordinary file | Normal after start, if the merger keeps ahead of the player |
| Time to first byte | Storage/CDN speed | Wait for the first segment to merge (INFERRED: about 0.3 to 2 s for a 2 to 4 s segment, to measure) |
| Compute | Once per video, in a queue, off the request path | Per viewer unless cached; spikes |
| Storage | Extra rendition | Same, if cached |
| Security | Verify before publishing the manifest | Must verify each segment before serving (harder) |
| Failure | "Not yet available" until ready; clean to retry | Fails during playback; harder to explain |
Recommendation: pre-render at ingest; allow lazy per-segment merge only as an "on first access" fallback behind the same cache, with single-flight so concurrent viewers share one merge.

**(b) Region-only processing (smart rendering)**

Re-encode only segments containing regions; copy the others. Facts: stream copy can cut only at keyframes, because decoding can only start at an independently decodable picture (PROVEN, [FFmpeg Seeking wiki](https://trac.ffmpeg.org/wiki/Seeking)); HLS segments should start at an independent frame and be decodable in isolation if `EXT-X-INDEPENDENT-SEGMENTS` is declared; a discontinuity tag is required if file format, tracks or the timestamp sequence change and recommended if encoding parameters change (PROVEN, [RFC 8216](https://datatracker.ietf.org/doc/html/rfc8216)); `EXT-X-BYTERANGE` lets a playlist point at ranges of one file (PROVEN, same RFC). Consequences (INFERRED):
- The segment length equals the source keyframe spacing (libx264 defaults to one keyframe in 250 frames, PROVEN, FFmpeg Seeking wiki). If the source has one keyframe every 10 s, a region anywhere in those 10 s forces a 10 s re-encode. If it has only one keyframe in the whole clip, nothing can be copied.
- Re-encoded segments must match the copied ones (codec, profile, level, resolution, frame rate, SPS/PPS, timebase), or players glitch at joins. Use the same parameters and closed GOPs; or pay for a full re-encode.
- Re-encoded segments are one generation lower in quality than copied ones; use a high-quality setting so the join is not visible.
- Road scenes: other vehicles' plates are probably in almost every segment, so copy segments may be rare. Measure the share of segments with regions in the spike before committing to this complexity.

**(c) Region track formats, storage and versioning**

| Format | Notes |
|---|---|
| JSON timed list (`{"v":1,"timebase":..., "regions":[{"id","label","t0","t1","keys":[{"t","x","y","w","h"}]}]}`) | Simple, diff-able, testable, schema-versioned; ours; recommended as the canonical store |
| WebVTT-style cues | WebVTT cue payloads are text with start and end times and a `metadata` track kind exists for time-aligned generic data; JSON in a cue is possible but must escape `&` and `<` and avoid blank lines (PROVEN, [MDN WebVTT API](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API)). Natural for a player overlay, which is exactly what we must NOT do with clean video. Useful only as an internal export for the review tool. |
| MP4 timed metadata track | Travels with the file (INFERRED) which is a risk: the track would ship with whatever file is delivered. Not used for delivery. |
Storage: in the restricted store with the original, keyed by (source content hash, track schema version, detector name and version, policy version). A track is immutable; a new detection makes a new version; the audit log records which version produced which rendition. The track has no personal data in text form but locates people and plates, so it gets the same access class as the original.

**(d) Hardware acceleration and codecs**

- NVENC encodes H.264, HEVC and AV1 on a dedicated block (PROVEN, NVIDIA guide above), so encoding does not compete with detection on the GPU's compute cores (INFERRED consequence). VAAPI covers Intel and AMD (INFERRED).
- FFmpeg filters: the generic `enable='between(t,a,b)'` option switches a filter on only for a time range (PROVEN, [FFmpeg filters doc](https://ffmpeg.org/ffmpeg-filters.html#boxblur), timeline editing section). `boxblur`, `avgblur`, `gblur`, `delogo`, `overlay` and `alphamerge` exist (PROVEN by the contents list on that page). Whether a spatial region can be limited with these filters directly was not shown on the page I read. Plan (INFERRED, to test): use `drawbox` with fill for a solid, irreversible region (positions as expressions in `t` for interpolation), or crop-blur-overlay chains; or a mask overlay (`alphamerge` plus `overlay`). Many regions make a long filtergraph; a JavaCV frame loop that paints regions from the track is simpler to generate and test.
- GPU filters and hardware download/upload cost: if the mask step runs on the CPU, each frame crosses the bus (INFERRED); for 10 to 60 second clips this may still be fine.
- Codec choice: H.264 for compatibility in all browsers (INFERRED); HEVC/AV1 are not universal in browsers. H.264 patent licensing is a legal topic (FFmpeg legal page, PROVEN).
- Licence of the encoder: libx264 is GPL; hardware encoders and `libopenh264` avoid GPL (INFERRED, check).

**(e) Detection cost: sampled frames plus tracking versus every frame**

| Approach | Cost | Recall risk |
|---|---|---|
| Every frame | Highest | Lowest (still need a track for padding) |
| Every Nth frame (for example every 3rd to 5th at 25 fps) plus tracking and interpolation | Roughly 1/N of the detector cost | A fast object appearing and leaving between samples; interpolation error; mitigated by padding and hysteresis |
| Adaptive: sample sparsely when the scene is stable, densely on motion/cuts | Between | More logic |
Recommendation: detect on every 2nd or 3rd frame, tracking in between, and then verify on every frame (or every 2nd) of the OUTPUT at lower cost (smaller model, or region-of-interest only). Detection runs once; verification runs once per rendition. Both are measured.

**(f) Caching merged outputs and time to first byte**

- Cache key: (source content hash, track version, renderer version, policy/offending-decision version). Because the offending-plate decision is made at ingest, the key does not include the viewer's input, so every entitled viewer shares one rendition (design; see section 6).
- Cache location: the same restricted storage class as the evidence images; served only via signed expiring links after the registration check; expires with the existing retention window (0011). Blurred does not mean public: the offending vehicle is visible.
- When the track version or renderer version changes, old renditions are unreachable and removed.
- TTFB: pre-rendered = storage/CDN latency (INFERRED); lazy merge = first segment latency plus single-flight. A "preparing" status with a retry hint is shown when not ready.
- Invalidation rule: if verification later finds a miss in a published rendition, withdraw the manifest, re-process, and record the event.

**(g) Interplay with upstream blurring**

- Prefer and verify upstream output or upstream track (section 5). If the verifier passes, there is nothing to add: copy the file through (the cheapest case, possibly the common one once upstream exists).
- If verification finds leftovers, add ONLY the missing regions to the track (a CEVOC-added layer) and render those segments; never blur a region that already passed verification.
- Record in the per-video status whether the release was `UPSTREAM_VERIFIED` (nothing added), `CEVOC_ADDED` (we blurred leftovers) or `CEVOC_FULL` (no upstream blurring found).

**(h) Measurement plan with rough per-minute cost and latency**

All figures below are INFERRED, not tested. They are planning ranges to be replaced by measurements.

| Step (1080p, 25 fps) | CPU worker (4 vCPU class, INFERRED) | GPU worker (single mid-range GPU with NVENC, INFERRED) |
|---|---|---|
| Decode 60 s | a few seconds | about 1 to 3 s |
| Detect faces and plates, every 3rd frame (about 500 frames per minute) | tens of seconds to a few minutes per minute of video, depending on model and tiling | a few seconds to ~20 s |
| Track and build JSON | under a second | under a second |
| Burn-in and encode H.264, full re-encode | about 0.3x to 1x real time (so 20 to 60 s for a minute) with a fast preset | about 0.05x to 0.2x real time |
| Verify output (every frame) | similar to a detection pass | a few seconds |
| Total for a 60 s clip | about 1 to 4 minutes | about 10 to 40 s |
| Cost per minute of video | a few cents or less at on-demand VM prices (INFERRED, check price lists) | similar order or lower per minute once busy; idle GPU time is the cost |
For 10 to 30 second clips the totals are proportionally smaller; the conclusion that matters is that an ingest queue absorbs this comfortably and playback is unaffected.

What to measure (on the sample footage in section 11): per-stage time, frames per second, memory, CPU/GPU use, output size, share of segments needing re-encode, TTFB for the lazy path, quality difference at joins (PSNR/SSIM and a visual look), and recall of the whole chain. Compare four variants: full re-encode, smart segments, drawbox versus JavaCV paint, CPU versus NVENC.

## 9. Architecture sketch (hexagonal)

Follows record 0001 (dependencies point inwards, `ArchitectureTest` enforces it) and records 0002 and 0008 (vendor specifics only behind adapters or deploy config). The information type `VIDEO` already exists as a placeholder with an outbound port `EvidenceVideoPort` and no adapter (PROVEN, 0007); images use `EvidenceImagePort` (PROPOSED, 0007).

```
 adapter.in.web  --->  application.service.MediaRelease  --->  EvidenceVideoPort / EvidenceImagePort (clean source, restricted)
                              |                                       
                              v  (domain: RedactionPolicy, RedactionStatus, RegionTrack)
                        application.port.out.BlurPort                  <-- swappable adapters
                              |   detect(media)      -> RegionTrack
                              |   render(media,track)-> blurred bytes/stream (one stream)
                              |   verify(blurred)    -> VerificationResult (detections above threshold)
                              v
   adapter.out.blur.*   (only place native / ML / FFmpeg libs may appear)
      OpenCvYuNetAdapter        (JavaCV/OpenCV, YuNet)
      OnnxRuntimeAdapter        (YOLOX / plate model via ONNX Runtime or DJL)
      FfmpegProcessAdapter      (subprocess in a container, LGPL build, optional NVENC)
      CloudDetectorAdapter      (optional; detection only; for a second opinion on blurred output)
      DenyAllBlurAdapter        (DEFAULT: fails closed, never releases video)
```

Ports and domain (names are proposals):
- `BlurPort` (application, out): `detect`, `render`, `verify`. Split into `RegionDetectorPort`, `MediaRendererPort`, `RedactionVerifierPort` if one adapter should not implement all three (for example a cloud adapter detects only).
- `RegionTrackStorePort`: read and write immutable, versioned tracks in restricted storage.
- Domain: `RegionTrack` (the JSON structure in 8.2c), `RedactionPolicy` (labels to blur, padding, thresholds, offending-plate rule), `RedactionStatus`, `VerificationResult` (counts above threshold, no pixels).
- Default configuration is `DenyAllBlurAdapter`, so a deployment with no blur adapter configured never releases video. Selected by a property in the same way as the three lookup routes (0010).
- Native libraries (`org.bytedeco`, ONNX Runtime) are allowed only in `adapter.out.blur` plus the bean config; add an `ArchitectureTest` rule like the one for `com.azure` (PROVEN pattern, ARCHITECTURE.md).
- A heavy detection job runs outside the web request: a queue and a worker (same code, different entry point), so the web container stays small (record 0011 notes the container runs small, PROVEN).

Flow (video):
1. Source arrives in restricted storage (clean original, or upstream-blurred file plus optional manifest).
2. Verify (section 5). Route: pass, add leftovers, or full redaction.
3. Detect (once) into `RegionTrack`; decide the offending plate (section 6); store the track.
4. Render the single blurred stream (smart segments or full encode); store it with signed-link access only.
5. Verify the OUTPUT again by content. Pass: status `AVAILABLE`, publish the manifest. Fail or timeout: status `FAILED` with a cause token, nothing published.
6. The web adapter hands the browser only a signed, expiring link to the blurred stream.

Per-video status feeding the transparency messages (0007). Domain status (internal) maps to the section statuses already defined:

| `RedactionStatus` | Meaning | Maps to 0007 status | Message kind |
|---|---|---|---|
| `NO_SOURCE` | No video for this offence or program | `NOT_APPLICABLE` or `NOT_YET_AVAILABLE` (by config) | by design, calm |
| `PENDING` | Queued or being prepared | `NOT_YET_AVAILABLE` with "being prepared" | by design, calm, retry later |
| `UPSTREAM_VERIFIED` | Upstream blurred and the content check passed | `AVAILABLE` | n/a |
| `CEVOC_ADDED` / `CEVOC_FULL` | We blurred (part or all) and the output check passed | `AVAILABLE` | n/a |
| `FAILED` + cause token (`detect-timeout`, `render-timeout`, `verify-failed`, `source-unreadable`, `adapter-missing`) | Could not make a verified video | `FAILED` | fault wording: "We could not prepare the video for safe viewing just now. This is a technical problem, not a choice. Try again in a few minutes." |
| `OFF_BY_CHOICE` | Program switch off | `OFF_BY_CHOICE` | by design |
Cause tokens are whitelisted (as in 0010); no frame, plate or region detail ever appears in a message, log or status.

Variant for the timed-track design (section 8): the same ports, with `render` taking a `RegionTrack` and returning segments; the track store is separate from the media store; the web adapter never sees the track.

## 10. Quality and assurance

- **Labelled test set** (open question: legal must approve the source): faces at several sizes, angles, behind windscreens, in shadow, at night with infrared, motion-blurred, partially occluded, on posters or screens; plates in several styles, small, angled, dirty, saturated; other vehicles in many positions. Annotated per frame by humans, double-checked. Start with synthetic and openly licensed material (section 11). Do not use real enforcement footage until legal agrees.
- **Metrics:** recall per object appearance AND per frame (a single clean frame can leak, so per-frame recall matters more than per-track); false positive rate (accepted if it keeps recall up); offending-plate decision accuracy (wrongly revealed other plate must be zero in the test set; wrongly hidden offending plate is tolerable but counted).
- **Recall targets:** proposals for legal to set, for example faces and non-offending plates at or above 99.5 percent per-frame recall on objects visible to a human at normal playback, 100 percent on the review sample after human correction. The paper cannot prove 100 percent; the aim is a process that makes a leak very rare, caught by the verifier and by review.
- **Sampling and human review:** pilot with 100 percent human review of the blurred output; later a statistical sample plus every video where the verifier and the first pass disagreed, or the confidence was low. Statistical aid: if no misses are found in n independently sampled videos, the miss rate is below about 3/n with 95 percent confidence (the "rule of three"; INFERRED standard result); n of 300 gives about 1 percent.
- **Audit log with no personal data:** opaque video id, source hash, track version, detector names and versions, thresholds, counts of regions by label, durations, verification result counts, route taken (`UPSTREAM_VERIFIED`, `CEVOC_ADDED`, `CEVOC_FULL`), outcome and cause token, reviewer decision and date. Never: frames, crops, plate text, registration, notice number, names, coordinates tied to a person.
- **Failure behaviour:** detector fails or times out, render fails, verification fails, a worker dies, storage unavailable, schema mismatch: do not release the video; show the not-available message with fault wording (0007); alert. Timeouts are set per stage. Retry is safe (idempotent by cache key). Never fall back to the clean file or to a UI overlay.
- **Regression:** the test set is rerun on every detector or model change; a drop in recall blocks the change.
- **Security tests:** a test that fetches every URL the page can reach and fails if any returns the clean video or the track; a test that the container has no public path to the original; a test that no thumbnail, poster or audio carries clean content.

Privacy and legal checklist for the legal team (INFERRED where not stated; each is a question, not an answer):
- Lawful basis and authority for processing third parties' images in CEVOC; privacy impact assessment.
- Retention of the original (how long, where, who can open it) and of the blurred rendition and of the track; deletion on schedule.
- Does a blurred output count as de-identified under the relevant law, and to what standard ("cannot be seen or recovered")? Is a fixed human viewing standard acceptable, or must it be tested against machine recovery attempts?
- Are faces on posters, screens, vehicle livery, or reflections included in "every human face"?
- Audio: remove it, keep it, or blur voices?
- Accessibility: blurred output must still meet the required captions/transcript/alternative rules if the program requires them; the "not available" messages must be accessible (live regions, plain wording).
- Evidence-pack PDF excludes video (PROVEN, 0011).
- Vendor use: any cloud detector requires data-sovereignty review, region lock, contract terms on retention and training use.
- Licences: AGPL (Ultralytics YOLO, OpenALPR) and non-commercial weights (InsightFace) are blocking issues unless a licence is bought or replaced; FFmpeg GPL build and H.264 patent position need a decision.
- Disclosure: what the motorist is told about blurring and what happens when blurring fails.
- Audit: who can see the audit log and the review queue; reviewer access to unblurred material and the training of reviewers.

## 11. Proposed small spike (design only, not started)

Goal: show the pipeline end to end and replace the INFERRED numbers with measured ones, using no real video, no real plates and no real people.

Footage (fictitious or openly licensed):
- Synthetic clips we produce ourselves: a rendered 3D scene (for example in Blender, which we create ourselves and release as CC0 in the repository docs or as a separate artefact) with stylised pedestrians and heads, cars with textures showing fictitious plates such as `ZZ00AA` style strings that do not belong to any real registration, day and night variants, camera motion and motion blur.
- Sintel (Blender Foundation), Creative Commons Attribution 3.0; reuse including commercial is allowed with attribution, "© copyright Blender Foundation | durian.blender.org" (PROVEN, [durian.blender.org/sharing](https://durian.blender.org/sharing/)). It contains animated faces, not photographic ones, so it tests the pipeline mechanics, not photographic recall. Big Buck Bunny from the same foundation is also under CC BY 3.0 (INFERRED, confirm before use); it has no humans.
- No photographic face data until legal approves a source. The WIDER FACE dataset is labelled "Creative Common License (cc by-nc-nd)" (PROVEN, [site](http://shuoyang1213.me/WIDERFACE/)) with real people's images; not suitable for our use without legal advice.

Scope (about one week of effort, INFERRED), all in a throwaway spike location outside `backend/`, `frontend/`, `prototype/`, the GitHub Pages workflow and `.github/workflows`:
1. Detect faces with YuNet and plates with one licence-checked detector on the synthetic clips; produce the JSON track (sampled frames plus tracker, padding, hysteresis).
2. Render two ways: JavaCV paint loop and FFmpeg `drawbox` driven by the track; full re-encode versus smart segments (HLS, keyframe-aligned).
3. Verify the output with a different detector; fail closed on timeout.
4. Offending-plate rule with a fictitious notice registration; check that a near match is not revealed.
5. Upstream cases: a clip with no blur, a clip with a heavy blur, a clip with a light blur, a clip with a lying "already blurred" flag; check routes and that nothing is blurred twice.
6. Still images: the same detectors on rendered stills; strip metadata and derive thumbnails from the blurred bytes.
7. Reversal test: try deblurring and depixelation on the output; confirm opaque fill or heavy blur resists.
8. Measure per-stage time and memory on a CPU container and, if available, a GPU instance; fill in section 8h.

Success criteria: 100 percent per-frame recall on the synthetic set for the labelled faces and non-offending plates (a low bar, because it is synthetic), no clean content on any reachable URL, fail-closed on every injected fault, and measured times that fit the ingest queue assumption.

## 12. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| A face or plate missed (night, windscreen, small, motion) | Privacy breach | Two detectors, low thresholds, tiling, hysteresis, output verification, human sampling; fail closed |
| Blur reversible | "Recovered" requirement failed | Opaque fill or heavy blur, burned in, reversal tests |
| Wrong plate revealed | Other person's plate shown | Exact match plus track identity; default to blur everything |
| Offending plate hidden | Motorist cannot see own plate | Accept; the images show it; message |
| Licence trap (AGPL, non-commercial weights, GPL FFmpeg, patents) | Legal exposure | Check each before adoption (section 4); pick Apache/MIT/BSD; legal review |
| Upstream flag lies or upstream tool changes | False sense of safety | Content verification always; alert on disagreement |
| Smart rendering joins glitch, little saving | Complexity without benefit | Measure first; pre-render full encode is acceptable |
| Cloud detector leaks originals | Disclosure | Self-host; cloud only on blurred output |
| Leaks via audio, thumbnails, metadata, caches, logs | Breach | Checklist in section 3; tests |
| Unknown clip length and volume | Capacity | Ingest queue; measure; scale workers |
| Detection cost on small web container | Slow or crash | Separate worker; do not run in the web container |
| Test data cannot be real | Weak recall evidence | Legal-approved dataset later; synthetic now; statistical limits stated |

## 13. Open questions

For the owner:
1. Typical and maximum clip length, frame rate, resolution, codec, and expected volume per day? When does video become available from the source?
2. Is upstream blurring burned in, or a separate track, and will it come with a signed manifest? Can upstream also say which vehicle is the offending one?
3. Is the licence budget for Ultralytics Enterprise acceptable, or is the rule "no AGPL, no non-commercial weights"?
4. Is the preference to run detection self-hosted only, or is a cloud second opinion acceptable?
5. Should the page wait with "being prepared" for first access, or only ever show finished videos?
6. Is the audio track dropped by default?
7. Do renditions follow the same retention window as the evidence images?

For legal:
1. The standard for "cannot be seen or recovered" and for acceptable recall.
2. Retention, lawful basis, and whether the blurred output counts as de-identified.
3. Faces on posters, screens and livery; passengers; faces behind glass at night.
4. Cloud vendors and data sovereignty.
5. Whether the dataset for recall testing can include real people's images, and from where.
6. FFmpeg GPL/LGPL distribution position, and H.264 patent position.
7. Accessibility obligations for video.

## 14. Sources

- YuNet in OpenCV Zoo: https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/README.md
- OpenCV licence: https://opencv.org/license/
- InsightFace README (a fork was read; check upstream): https://github.com/thienpn/insightface
- MediaPipe face detector: https://developers.google.com/edge/mediapipe/solutions/vision/face_detector
- Ultralytics licence: https://ultralytics.com/license
- YOLOX: https://github.com/Megvii-BaseDetection/YOLOX
- FastALPR: https://github.com/ankandrew/fast-alpr
- OpenALPR (Wikipedia): https://en.wikipedia.org/wiki/OpenALPR
- ByteTrack: https://github.com/FoundationVision/ByteTrack
- JavaCV: https://github.com/bytedeco/javacv
- FFmpeg legal: https://ffmpeg.org/legal.html
- FFmpeg seeking wiki: https://trac.ffmpeg.org/wiki/Seeking
- FFmpeg filters: https://ffmpeg.org/ffmpeg-filters.html#boxblur
- NVENC programming guide: https://docs.nvidia.com/video-technologies/video-codec-sdk/13.0/nvenc-video-encoder-api-prog-guide/index.html
- HLS (RFC 8216): https://datatracker.ietf.org/doc/html/rfc8216
- WebVTT API (MDN): https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API
- Amazon Rekognition pricing: https://aws.amazon.com/rekognition/pricing/
- Rekognition in Sydney (announcement): https://aws.amazon.com/de/about-aws/whats-new/2018/02/amazon-rekognition-now-available-in-aws-asia-pacific-tokyo-and-asia-pacific-sydney-regions/
- Sintel sharing terms: https://durian.blender.org/sharing/
- WIDER FACE: http://shuoyang1213.me/WIDERFACE/
