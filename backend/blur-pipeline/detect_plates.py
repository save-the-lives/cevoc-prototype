#!/usr/bin/env python3
"""
Plate detection for the CEVOC blurring pipeline.

Uses a YOLOv8n licence plate detector (ONNX, via OpenCV DNN) for fast CPU
inference.  Plates are tracked across frames by spatial proximity; each track
is OCR'd ONCE on its best (largest) crop using pytesseract.  ABC123 (or the
nominated offending plate) is labelled PLATE_OFFENDING and kept visible by
render_blur; all other plates are labelled PLATE and blurred.

Output: JSON region track compatible with merge_tracks.py / render_blur.py.

Usage: python3 detect_plates.py <video.mp4> [--offending ABC123] [--output regions.json]
"""
import argparse
import json
import sys
import time
from pathlib import Path

print("[detect_plates] importing cv2...", flush=True)
import cv2
print("[detect_plates] importing numpy...", flush=True)
import numpy as np
print("[detect_plates] imports done", flush=True)

try:
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False

# ---------------------------------------------------------------------------
# YOLO plate detector (cv2.dnn, no torch/ultralytics needed)
# ---------------------------------------------------------------------------
MODEL_NAME = "yolov8n-plates.onnx"
INPUT_SIZE = 640
CONF_THRESH = 0.30
NMS_THRESH = 0.45


def load_yolo(scripts_dir: Path):
    """Load the YOLO ONNX model via OpenCV DNN."""
    model_path = scripts_dir / MODEL_NAME
    if not model_path.exists():
        print(f"[detect_plates] ERROR: model not found at {model_path}", flush=True)
        sys.exit(1)
    print(f"[detect_plates] Loading YOLO model from {model_path}", flush=True)
    t0 = time.time()
    net = cv2.dnn.readNetFromONNX(str(model_path))
    print(f"[detect_plates] YOLO loaded in {(time.time()-t0)*1000:.0f}ms", flush=True)
    return net


def detect_plates_yolo(net, frame, conf_thresh=CONF_THRESH, nms_thresh=NMS_THRESH):
    """Run YOLO inference on a single frame, return list of plate dicts."""
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (INPUT_SIZE, INPUT_SIZE),
                                 swapRB=True, crop=False)
    net.setInput(blob)
    output = net.forward()  # (1, 5, 8400) for 1-class YOLOv8

    # Transpose to (8400, 5): cx, cy, bw, bh, conf
    data = output[0].T

    # Filter by confidence
    mask = data[:, 4] > conf_thresh
    candidates = data[mask]
    if len(candidates) == 0:
        return []

    # Convert to x1,y1,w,h for NMS
    scale_x = w / INPUT_SIZE
    scale_y = h / INPUT_SIZE

    boxes = []
    confs = []
    for row in candidates:
        cx, cy, bw, bh, conf = row
        x1 = (cx - bw / 2) * scale_x
        y1 = (cy - bh / 2) * scale_y
        pw = bw * scale_x
        ph = bh * scale_y
        boxes.append([int(x1), int(y1), int(pw), int(ph)])
        confs.append(float(conf))

    # OpenCV NMS
    indices = cv2.dnn.NMSBoxes(boxes, confs, conf_thresh, nms_thresh)
    if len(indices) == 0:
        return []

    plates = []
    for i in indices.flatten():
        x, y, pw, ph = boxes[i]
        plates.append({
            "x": max(0, x), "y": max(0, y),
            "w": pw, "h": ph,
            "confidence": round(confs[i], 3),
            "plate_text": None,
        })
    return plates


# ---------------------------------------------------------------------------
# OCR — one call per track, on the best (largest) crop
# ---------------------------------------------------------------------------

def ocr_plate_region(frame, x, y, w, h, pad=5):
    """Read plate text from one crop using pytesseract (called ONCE per track)."""
    if not HAS_OCR:
        return None
    fh, fw = frame.shape[:2]
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(fw, x + w + pad)
    y2 = min(fh, y + h + pad)
    roi = frame[y1:y2, x1:x2]
    if roi.size == 0:
        return None

    gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
    # Upscale small plates for better OCR
    scale = max(1, 80 // max(gray.shape[0], 1))
    if scale > 1:
        gray = cv2.resize(gray, None, fx=scale, fy=scale,
                          interpolation=cv2.INTER_CUBIC)
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    _, gray = cv2.threshold(gray, 0, 255,
                            cv2.THRESH_BINARY | cv2.THRESH_OTSU)

    config = "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    try:
        text = pytesseract.image_to_string(gray, config=config).strip()
        text = "".join(c for c in text if c.isalnum())
        return text if len(text) >= 3 else None
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_video(video_path, offending_plate="ABC123", every_n=2):
    """Process a video, detect plates, track, OCR once per track."""
    scripts_dir = Path(__file__).parent
    net = load_yolo(scripts_dir)

    print(f"[detect_plates] Opening video: {video_path}", flush=True)
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error: cannot open {video_path}", file=sys.stderr, flush=True)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total / fps if fps else 0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"[detect_plates] Video: {video_path}", flush=True)
    print(f"[detect_plates]   {w}x{h}, {fps} fps, {total} frames, {duration:.1f}s",
          flush=True)
    print(f"[detect_plates]   Processing every {every_n} frame(s)", flush=True)
    print(f"[detect_plates]   Offending plate: {offending_plate}", flush=True)
    print(f"[detect_plates]   OCR: {'pytesseract (once per track)' if HAS_OCR else 'unavailable'}",
          flush=True)

    # ------------------------------------------------------------------
    # Pass 1: detect plates in sampled frames, save best frame per track
    # ------------------------------------------------------------------
    all_detections = []  # (frame_num, t_sec, plates)
    best_frames = {}     # track_idx -> (area, frame_copy, x, y, w, h)
    tracks = []          # list of lists of detection entries
    track_last_pos = []  # last (x, y, w, h) per track

    frame_num = 0
    t_detect_start = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num % every_n == 0:
            plates = detect_plates_yolo(net, frame)
            t_sec = round(frame_num / fps, 3)

            if frame_num % (every_n * 10) == 0:
                print(f"[detect_plates]   frame {frame_num}/{total} — "
                      f"{len(plates)} plates", flush=True)

            # Assign to tracks by spatial proximity
            used = set()
            for p in plates:
                cx = p["x"] + p["w"] // 2
                cy = p["y"] + p["h"] // 2
                best_track = None
                best_dist = float("inf")
                for ti, (lx, ly, lw, lh) in enumerate(track_last_pos):
                    lcx, lcy = lx + lw // 2, ly + lh // 2
                    dist = ((cx - lcx) ** 2 + (cy - lcy) ** 2) ** 0.5
                    if (dist < max(p["w"], lw) * 2.5
                            and dist < best_dist and ti not in used):
                        best_dist = dist
                        best_track = ti

                entry = {
                    "t": t_sec,
                    "x": p["x"], "y": p["y"],
                    "w": p["w"], "h": p["h"],
                    "confidence": p["confidence"],
                }

                if best_track is not None:
                    tracks[best_track].append(entry)
                    track_last_pos[best_track] = (p["x"], p["y"],
                                                  p["w"], p["h"])
                    used.add(best_track)
                    ti = best_track
                else:
                    tracks.append([entry])
                    track_last_pos.append((p["x"], p["y"],
                                          p["w"], p["h"]))
                    ti = len(tracks) - 1

                # Keep the largest crop per track for OCR
                area = p["w"] * p["h"]
                if ti not in best_frames or area > best_frames[ti][0]:
                    best_frames[ti] = (area, frame.copy(),
                                       p["x"], p["y"], p["w"], p["h"])

        frame_num += 1

    cap.release()
    t_detect = time.time() - t_detect_start
    print(f"[detect_plates]   Detection done: {frame_num} frames in "
          f"{t_detect:.1f}s", flush=True)

    # ------------------------------------------------------------------
    # Pass 2: OCR the best frame of each track (ONCE per track)
    # ------------------------------------------------------------------
    offending_norm = offending_plate.replace(" ", "").upper() if offending_plate else ""
    t_ocr_start = time.time()

    regions = []
    for ti, track in enumerate(tracks):
        if not track:
            continue

        plate_text = None
        if HAS_OCR and ti in best_frames:
            _, bframe, bx, by, bw, bh = best_frames[ti]
            plate_text = ocr_plate_region(bframe, bx, by, bw, bh)

        is_offending = False
        if plate_text:
            norm = plate_text.replace(" ", "").upper()
            is_offending = (norm == offending_norm)

        label = "PLATE_OFFENDING" if is_offending else "PLATE"

        frames = []
        for e in track:
            frames.append({
                "t": e["t"],
                "x": e["x"], "y": e["y"],
                "w": e["w"], "h": e["h"],
                "confidence": e["confidence"],
            })

        regions.append({
            "label": label,
            "plate_text": plate_text,
            "frames": frames,
        })

    t_ocr = time.time() - t_ocr_start
    total_time = t_detect + t_ocr
    print(f"[detect_plates]   OCR done: {len(tracks)} tracks in "
          f"{t_ocr:.1f}s", flush=True)
    print(f"[detect_plates]   Total: {total_time:.1f}s", flush=True)

    result = {
        "v": 1,
        "video": str(video_path),
        "resolution": f"{w}x{h}",
        "fps": fps,
        "duration_s": round(duration, 3),
        "offending_plate": offending_plate,
        "detection_method": "YOLOv8n (ONNX, OpenCV DNN)",
        "ocr": "pytesseract (once per track)" if HAS_OCR else "none",
        "regions": regions,
        "stats": {
            "frames_processed": frame_num // every_n,
            "total_frames": frame_num,
            "tracks_found": len(regions),
            "offending_found": sum(1 for r in regions
                                   if r["label"] == "PLATE_OFFENDING"),
            "processing_time_s": round(total_time, 1),
            "detect_time_s": round(t_detect, 1),
            "ocr_time_s": round(t_ocr, 1),
        },
    }
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Detect licence plates in traffic camera video")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--offending", default="ABC123",
                        help="Offending plate text (default: ABC123)")
    parser.add_argument("--output", default=None,
                        help="Output JSON file")
    parser.add_argument("--every", type=int, default=2,
                        help="Process every Nth frame (default: 2)")
    args = parser.parse_args()

    result = process_video(args.video, args.offending, args.every)

    # Summary
    print(f"\nResults:", flush=True)
    print(f"  Tracks: {result['stats']['tracks_found']}", flush=True)
    offending_found = result["stats"]["offending_found"]
    print(f"  Offending ({args.offending}): "
          f"{'FOUND' if offending_found else 'NOT FOUND'}", flush=True)
    for r in result["regions"]:
        txt = r["plate_text"] or "(unread)"
        print(f"    [{r['label']}] {txt}: {len(r['frames'])} detections",
              flush=True)

    out_path = (args.output or
                str(Path(__file__).parent / "plate-regions.json"))
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    print(f"\nSaved to {out_path}", flush=True)


if __name__ == "__main__":
    main()
