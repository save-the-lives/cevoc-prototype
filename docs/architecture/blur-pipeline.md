# Privacy blur pipeline

All evidence media (video and images) passes through a server-side blur pipeline before being shown to the user. The pipeline is **fail-closed**: if blurring fails or leaked content is detected after 3 verification passes, the media is never served.

## Pipeline stages

```
Input video/image
       │
       ▼
┌──────────────┐
│ 1. FACE       │  YuNet (OpenCV built-in)
│    DETECTION   │  Finds faces in every frame
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 2. PLATE      │  YOLOv8n ONNX (yolov8n-plates.onnx, 12MB)
│    DETECTION   │  Finds registration plates, confidence threshold 0.15
└──────┬───────┘  20% padding on all boxes
       │
       ▼
┌──────────────┐
│ 3. VEHICLE    │  YOLOv8n ONNX (yolov8n.onnx, COCO classes)
│    BACKSTOP   │  Finds cars/trucks/buses; infers plate region
└──────┬───────┘  for any vehicle without a confirmed plate detection
       │
       ▼
┌──────────────┐
│ 4. TRACK      │  Links detections across frames by IoU
│    BUILDING    │  Interpolates gaps up to 5 frames
└──────┬───────┘  every_n=1 (every frame processed)
       │
       ▼
┌──────────────┐
│ 5. RENDER     │  Gaussian blur (kernel size scaled to region)
│    BLUR        │  Offending plate (ABC123 in demo) is SKIPPED
└──────┬───────┘  via IoU overlap with offending regions
       │
       ▼
┌──────────────┐
│ 6. VERIFY     │  Re-runs plate detection on blurred output
│    (up to 3x) │  Any leaked non-offending plate → re-blur
└──────┬───────┘  If still leaking after 3 passes → EXIT NON-ZERO
       │
       ▼
┌──────────────┐
│ 7. ENCODE     │  ffmpeg: libx264, yuv420p, +faststart
│    FOR WEB     │  Web-compatible MP4
└──────┬───────┘
       │
       ▼
    Blurred output (or failure)
```

## Fail-closed behaviour

| Condition | Result |
|---|---|
| Blur completes, verification passes | Video served normally |
| Blur completes, verification fails after 3 passes | `render_blur.py` exits non-zero → `ProcessBlurAdapter.Result.failed()` → HTTP 451 |
| Blur script crashes or times out (120s) | `ProcessBlurAdapter` returns `Result.failed()` → HTTP 451 |
| YOLO model file missing | Verification skipped (logged), but initial blur still runs |
| Any unexpected error | Video is never served; frontend shows "Preparing video for safe viewing..." |

## Models and licences

| Model | Source | Licence | Size |
|---|---|---|---|
| YuNet face detector | OpenCV project | Apache 2.0 | Built into OpenCV |
| YOLOv8n plate detector | Third-party trained, Ultralytics architecture | CC BY 4.0 (stated) / AGPL (base) | 12MB ONNX |
| YOLOv8n COCO (car backstop) | Ultralytics | AGPL v3 | 12MB ONNX |
| OpenCV | OpenCV project | Apache 2.0 | pip package |
| ffmpeg | FFmpeg project | GPL (subprocess only, not linked) | System package |

See `docs/research/blur-pipeline-licences.md` for detailed licence analysis and open questions for legal.

## Files

| File | Purpose |
|---|---|
| `backend/blur-pipeline/detect_faces.py` | YuNet face detection → JSON regions |
| `backend/blur-pipeline/detect_plates.py` | YOLOv8n plate detection + vehicle backstop + tracking → JSON regions |
| `backend/blur-pipeline/render_blur.py` | Blur rendering + verification loop + web encoding |
| `backend/blur-pipeline/yolov8n-plates.onnx` | Plate detection model weights |
| `backend/blur-pipeline/yunet.onnx` | Face detection model weights |
| `backend/src/.../blur/ProcessBlurAdapter.java` | Java adapter: runs Python scripts as subprocess |

## Extending

To add a new detection type (e.g. text overlay removal):

1. Add a new detection script in `backend/blur-pipeline/` that outputs JSON regions
2. Add the script call to `ProcessBlurAdapter.blurSync()` pipeline
3. The render step already handles any region with `{x, y, w, h}` — no changes needed
4. Add the new model to `backend/Dockerfile`
5. Update licence docs
