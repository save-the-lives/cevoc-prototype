# Blur Pipeline — Component Licences

> **Not legal advice.** This note records the licence of every component in
> the privacy blur pipeline (ADR 0017) so TfNSW legal can assess production
> implications. Claims are marked **PROVEN** (read from the verifiable source)
> or **INFERRED** (from community understanding, not confirmed by legal authority).
>
> As-of: 10 November 2026.

## Components

### 1. YOLOv8n Licence Plate Detector (`yolov8n-plates.onnx`, 12 MB)

| Field | Value |
|---|---|
| Source | [HuggingFace: Murd0ck/LicensePlateDetector_YOLOv8n](https://huggingface.co/Murd0ck/LicensePlateDetector_YOLOv8n) |
| Trainer | WaveAutomaton (HuggingFace user Murd0ck) |
| Base model | Ultralytics YOLOv8n (`yolov8n.pt`) |
| Training data | AUTO.RIA Numberplate Options Dataset (Ukrainian plates), CC BY 4.0 |
| Model card licence | **CC BY 4.0** (PROVEN — stated on the model card) |
| Base model licence | **AGPL-3.0** (PROVEN — Ultralytics `ultralytics` repo, [LICENCE file](https://github.com/ultralytics/ultralytics/blob/main/LICENSE)) |
| How we use it | ONNX weights loaded via `cv2.dnn.readNetFromONNX()`. No Ultralytics Python package installed or imported. |

**Implications:**

- The model card states CC BY 4.0, but the weights were derived by fine-tuning
  the Ultralytics YOLOv8n checkpoint, which is AGPL-3.0. Whether AGPL
  applies to derived ONNX weights run through a non-Ultralytics inference
  engine (OpenCV DNN) is **legally unsettled** (INFERRED — community debate,
  no court ruling or official FSF guidance found).
- Ultralytics' own position: they state that "any product or service" using
  their models requires either full open-source release under AGPL or an
  [Ultralytics Enterprise Licence](https://www.ultralytics.com/license) (INFERRED —
  from their website and community statements; the exact scope is debated).
- The repo is currently public, which reduces but does not eliminate AGPL risk.

### 2. YuNet Face Detector (`yunet.onnx`, 232 KB)

| Field | Value |
|---|---|
| Source | [OpenCV Zoo](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) |
| Licence | **MIT** (PROVEN — stated in the OpenCV Zoo repo) |
| Paper | Yu et al., "YuNet: A Tiny Millisecond-Level Face Detector" |
| How we use it | ONNX weights loaded via `cv2.FaceDetectorYN.create()` |

**Implications:** Permissive. No restrictions on commercial or government use.

### 3. OpenCV (`opencv-contrib-python-headless`)

| Field | Value |
|---|---|
| Source | [PyPI: opencv-contrib-python-headless](https://pypi.org/project/opencv-contrib-python-headless/) |
| Licence | **Apache 2.0** for the main library (PROVEN — [OpenCV LICENCE](https://github.com/opencv/opencv/blob/master/LICENSE)). The `contrib` modules may carry individual licences; the headless wheel bundles FFmpeg under LGPL. |
| How we use it | DNN module for YOLO/YuNet inference, image processing, video I/O |

**Implications:** Permissive. The bundled FFmpeg in the pip wheel is built
with `--enable-nonfree` disabled, LGPL-compatible (INFERRED — from the
opencv-python build scripts).

### 4. NumPy

| Field | Value |
|---|---|
| Source | [PyPI: numpy](https://pypi.org/project/numpy/) |
| Licence | **BSD-3-Clause** (PROVEN — [NumPy LICENCE](https://github.com/numpy/numpy/blob/main/LICENSE.txt)) |

**Implications:** Permissive. No restrictions.

### 5. Pytesseract + Tesseract OCR

| Field | Value |
|---|---|
| Pytesseract | [PyPI: pytesseract](https://pypi.org/project/pytesseract/), **Apache 2.0** (PROVEN) |
| Tesseract | [GitHub: tesseract-ocr/tesseract](https://github.com/tesseract-ocr/tesseract), **Apache 2.0** (PROVEN — [LICENCE](https://github.com/tesseract-ocr/tesseract/blob/main/LICENSE)) |
| How we use it | OCR disabled by default (too slow); available via `--ocr` flag for per-track plate reading |

**Implications:** Permissive. Currently disabled in the pipeline. If re-enabled
with a faster approach (once-per-track), no licence concern.

### 6. FFmpeg (system package)

| Field | Value |
|---|---|
| Source | Ubuntu 22.04 (Jammy) `ffmpeg` apt package, version 4.4.x |
| Licence | **GPL-2.0-or-later** (PROVEN — Ubuntu builds ffmpeg with `--enable-gpl` and links `libx264`, which is GPL-2.0) |
| How we use it | Called as a subprocess by `render_blur.py` to re-encode blurred video with H.264 (`libx264`) and `+faststart` |

**Implications:**

- The Ubuntu ffmpeg binary is GPL because it links GPL libraries (libx264).
  Running it as a **separate process** (subprocess, not linked into our code)
  generally does not make the calling application a derivative work under GPL
  (INFERRED — widely held legal understanding, but not tested in court for
  this specific scenario).
- **Alternative:** The LGPL build of ffmpeg (without libx264) could use
  `libx264` as a runtime-loaded shared library, or use a different encoder
  (e.g. `libopenh264`, BSD-2-Clause). This would avoid the GPL question
  entirely.

### 7. Ultralytics Framework (not installed)

| Field | Value |
|---|---|
| Licence | **AGPL-3.0** (PROVEN — [GitHub repo](https://github.com/ultralytics/ultralytics)) |
| How we use it | **Not installed.** The YOLOv8n plate model was trained by a third party using Ultralytics tools, then exported to ONNX. We load the ONNX file through OpenCV DNN. No Ultralytics code runs in the container. |

**Implications:** See item 1 above. The open question is whether weights
derived from AGPL-licensed training code carry the AGPL obligation when
run through a completely different inference engine.

## Risk Summary

| Component | Licence | Risk for public TfNSW service |
|---|---|---|
| YuNet | MIT | None |
| OpenCV | Apache 2.0 | None |
| NumPy | BSD-3-Clause | None |
| Pytesseract / Tesseract | Apache 2.0 | None |
| YOLOv8n plate weights | CC BY 4.0 (stated) / AGPL-3.0 (base) | **Medium** — unsettled |
| FFmpeg (Ubuntu) | GPL-2.0 (subprocess) | **Low** — subprocess isolation |
| Ultralytics framework | AGPL-3.0 (not installed) | **Low–Medium** — derivative weight question |

## Options for Production

1. **Keep current setup, repo stays public.** Lowest effort. AGPL network
   clause is satisfied if the full source is available (it is). Risk: if the
   repo goes private or the service is offered by a different entity, AGPL
   obligations may not be met.

2. **Buy Ultralytics Enterprise Licence.** Removes AGPL ambiguity for the
   plate model weights. Cost: starts at ~$1,695/yr (INFERRED — from their
   pricing page, subject to change).

3. **Replace the plate model with a permissive alternative.** Options:
   - Train a plate detector from scratch on a permissive dataset using a
     permissive framework (e.g. YOLOX, Apache 2.0; or RT-DETR).
   - Use a pre-trained permissive plate detector (fewer options available).
   - Use OpenCV's built-in cascade classifiers (lower accuracy, no AGPL).

4. **Replace FFmpeg subprocess with LGPL-compatible encoding.** Use
   `libopenh264` (BSD-2-Clause) or the LGPL ffmpeg build without libx264.

5. **Open-source the CEVOC application under AGPL.** Satisfies AGPL
   obligations fully. May conflict with TfNSW IP policy.

## Open Questions for Legal

1. Do ONNX weights derived from an AGPL-licensed base model, loaded through
   a non-AGPL inference engine (OpenCV), trigger AGPL obligations on the
   calling application?
2. Does running GPL-licensed ffmpeg as a subprocess (not linked) make the
   calling Java application a derivative work?
3. If the repo is public now but may go private for production, what AGPL
   obligations persist for users who accessed the public version?
4. Does the CC BY 4.0 licence on the model card override or coexist with
   the AGPL on the base model weights?
5. Is the Ultralytics Enterprise Licence compatible with TfNSW procurement
   and the vendor-neutrality principle (ADR 0002)?
