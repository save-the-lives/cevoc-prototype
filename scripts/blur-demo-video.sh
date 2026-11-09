#!/usr/bin/env bash
# Pre-blur the demo video: detect faces (YuNet) and plates (contour+OCR),
# merge tracks, render blurred output with ABC123 kept visible.
#
# Replaces frontend/public/samples/video-1.mp4 with the blurred version.
# Keeps the raw original at frontend/public/samples/video-1-raw.mp4.
#
# Prerequisites: python3, opencv-contrib-python, pytesseract, tesseract-ocr, ffmpeg
# Usage: ./scripts/blur-demo-video.sh [--offending ABC123]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SPIKE="$REPO_ROOT/scripts/blur-spike"
SAMPLES="$REPO_ROOT/frontend/public/samples"
OFFENDING="${1:-ABC123}"

RAW="$SAMPLES/video-1-raw.mp4"
TARGET="$SAMPLES/video-1.mp4"

# Keep the raw original if not already backed up
if [ ! -f "$RAW" ]; then
  cp "$TARGET" "$RAW"
  echo "Backed up raw video to video-1-raw.mp4"
fi

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

echo "=== Step 1: Detect faces (YuNet) ==="
python3 -I - "$RAW" "$WORK/face-regions.json" "$SPIKE/yunet.onnx" <<'PYEOF'
import cv2, json, sys, time
video, output, model_path = sys.argv[1], sys.argv[2], sys.argv[3]
PAD = 0.4
cap = cv2.VideoCapture(video)
fps = cap.get(cv2.CAP_PROP_FPS)
w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
det = cv2.FaceDetectorYN.create(model_path, '', (w, h), 0.4, 0.3, 5000)
regions, rid, fnum, total = [], 0, 0, 0
t0 = time.time()
while True:
    ret, frame = cap.read()
    if not ret: break
    t = fnum / fps
    ok, faces = det.detect(frame)
    if faces is not None:
        for f in faces:
            fx, fy, fw, fh = int(f[0]), int(f[1]), int(f[2]), int(f[3])
            px, py = int(fw * PAD), int(fh * PAD)
            fx, fy = max(0, fx - px), max(0, fy - py)
            fw = min(w - fx, fw + 2*px)
            fh = min(h - fy, fh + 2*py)
            regions.append({'id': rid, 'label': 'FACE', 'frames': [
                {'t': round(t, 4), 'frame': fnum, 'label': 'FACE',
                 'x': fx, 'y': fy, 'w': fw, 'h': fh, 'confidence': round(float(f[-1]), 3)}
            ]})
            rid += 1; total += 1
    fnum += 1
cap.release()
with open(output, 'w') as f: json.dump({'v': 1, 'detector': 'YuNet', 'regions': regions}, f)
print(f"  YuNet: {total} faces in {fnum} frames ({time.time()-t0:.1f}s)")
PYEOF

echo "=== Step 2: Detect plates (contour + OCR) ==="
python3 -I "$SPIKE/detect_plates.py" "$RAW" --offending "$OFFENDING" --output "$WORK/plate-regions.json" 2>&1 | sed 's/^/  /'

echo "=== Step 3: Merge tracks ==="
python3 -I - "$WORK/face-regions.json" "$WORK/plate-regions.json" "$WORK/merged.json" <<'PYEOF'
import json, sys
faces_f, plates_f, out_f = sys.argv[1], sys.argv[2], sys.argv[3]
with open(faces_f) as f: faces = json.load(f)
with open(plates_f) as f: plates = json.load(f)
merged = {'v': 1, 'regions': []}
for r in faces.get('regions', []):
    for det in r.get('frames', []):
        det['label'] = r.get('label', 'FACE')
        if 'frame' not in det:
            det['frame'] = int(det['t'] * 12)  # default fps
    merged['regions'].append(r)
for r in plates.get('regions', []):
    for det in r.get('frames', []):
        det['label'] = r.get('label', 'PLATE')
        if 'frame' not in det:
            det['frame'] = int(det['t'] * 12)
    merged['regions'].append(r)
with open(out_f, 'w') as f: json.dump(merged, f)
face_n = len(faces.get('regions', []))
plate_n = len(plates.get('regions', []))
offending = sum(1 for r in plates.get('regions', []) if r.get('label') == 'PLATE_OFFENDING')
print(f"  Merged: {face_n} face + {plate_n} plate tracks ({offending} offending = kept visible)")
PYEOF

echo "=== Step 4: Render blurred video ==="
python3 -I "$SPIKE/render_blur.py" "$RAW" "$WORK/merged.json" --output "$WORK/blurred.mp4" 2>&1 | sed 's/^/  /'

echo "=== Step 5: Replace demo video ==="
cp "$WORK/blurred.mp4" "$TARGET"
SIZE_MB=$(echo "scale=1; $(stat -c%s "$TARGET") / 1048576" | bc)
echo "  Replaced video-1.mp4 with blurred version (${SIZE_MB} MB)"
echo "  Raw original at video-1-raw.mp4"
echo ""
echo "Done. ABC123 is visible; all other faces and plates are blurred."
