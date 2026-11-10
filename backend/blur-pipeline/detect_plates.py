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
PLATE_MODEL = "yolov8n-plates.onnx"
INPUT_SIZE = 640
# Low threshold — false positives are fine, missed plates are not
CONF_THRESH = 0.15
NMS_THRESH = 0.45
# Padding: expand each detection box by this fraction on each side
PAD_FRAC = 0.20


def load_yolo(scripts_dir: Path, model_name: str):
    """Load a YOLO ONNX model via OpenCV DNN."""
    model_path = scripts_dir / model_name
    if not model_path.exists():
        print(f"[detect_plates] WARNING: model not found at {model_path}", flush=True)
        return None
    print(f"[detect_plates] Loading model from {model_path}", flush=True)
    t0 = time.time()
    net = cv2.dnn.readNetFromONNX(str(model_path))
    print(f"[detect_plates]   Loaded in {(time.time()-t0)*1000:.0f}ms", flush=True)
    return net


def detect_yolo(net, frame, conf_thresh, nms_thresh=NMS_THRESH, num_classes=1):
    """Run YOLO inference on a single frame, return list of dicts with x,y,w,h,confidence,class_id."""
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (INPUT_SIZE, INPUT_SIZE),
                                 swapRB=True, crop=False)
    net.setInput(blob)
    output = net.forward()  # (1, 4+num_classes, 8400)

    data = output[0].T  # (8400, 4+num_classes)
    scale_x = w / INPUT_SIZE
    scale_y = h / INPUT_SIZE

    boxes, confs, class_ids = [], [], []
    for row in data:
        cx, cy, bw, bh = row[:4]
        if num_classes == 1:
            conf = float(row[4])
            cls_id = 0
        else:
            scores = row[4:]
            cls_id = int(np.argmax(scores))
            conf = float(scores[cls_id])
        if conf < conf_thresh:
            continue
        x1 = (cx - bw / 2) * scale_x
        y1 = (cy - bh / 2) * scale_y
        pw = bw * scale_x
        ph = bh * scale_y
        boxes.append([int(x1), int(y1), int(pw), int(ph)])
        confs.append(conf)
        class_ids.append(cls_id)

    if not boxes:
        return []

    indices = cv2.dnn.NMSBoxes(boxes, confs, conf_thresh, nms_thresh)
    if len(indices) == 0:
        return []

    results = []
    for i in indices.flatten():
        x, y, pw, ph = boxes[i]
        results.append({
            "x": max(0, x), "y": max(0, y),
            "w": pw, "h": ph,
            "confidence": round(confs[i], 3),
            "class_id": class_ids[i],
        })
    return results


def pad_box(x, y, w, h, img_w, img_h, frac=PAD_FRAC):
    """Expand a box by frac on each side, clamped to image bounds."""
    px = int(w * frac)
    py = int(h * frac)
    nx = max(0, x - px)
    ny = max(0, y - py)
    nw = min(img_w - nx, w + 2 * px)
    nh = min(img_h - ny, h + 2 * py)
    return nx, ny, nw, nh


# ---------------------------------------------------------------------------
# Vehicle backstop: detect vehicles, blur plate region of any without a plate
# ---------------------------------------------------------------------------
# COCO class IDs for vehicles
VEHICLE_CLASSES = {2: "car", 5: "bus", 7: "truck"}
VEHICLE_MODEL = "yolov8n.onnx"
VEHICLE_CONF = 0.30


def vehicle_backstop_plates(vehicles, plate_dets, img_w, img_h):
    """For vehicles without a nearby plate detection, infer a plate region."""
    backstop = []
    for v in vehicles:
        # Check if any plate detection overlaps this vehicle
        has_plate = False
        for p in plate_dets:
            # Plate center inside vehicle box?
            pcx = p["x"] + p["w"] // 2
            pcy = p["y"] + p["h"] // 2
            if (v["x"] <= pcx <= v["x"] + v["w"] and
                    v["y"] <= pcy <= v["y"] + v["h"]):
                has_plate = True
                break
        if has_plate:
            continue
        # Infer plate region: bottom center of vehicle, ~15% height, ~40% width
        pw = int(v["w"] * 0.45)
        ph = int(v["h"] * 0.18)
        px = v["x"] + (v["w"] - pw) // 2
        py = v["y"] + v["h"] - ph - int(v["h"] * 0.05)  # slightly above bottom
        px, py, pw, ph = pad_box(px, py, pw, ph, img_w, img_h, frac=0.1)
        backstop.append({
            "x": px, "y": py, "w": pw, "h": ph,
            "confidence": 0.10,  # low confidence marker
            "source": "vehicle_backstop",
        })
    return backstop


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
# Track interpolation: fill gaps in each track with linear interpolation
# ---------------------------------------------------------------------------

def interpolate_tracks(tracks, total_frames, fps):
    """For each track, fill gaps between detections with interpolated boxes."""
    for track in tracks:
        if len(track) < 2:
            continue
        # Build frame->entry map
        by_frame = {}
        for e in track:
            fn = int(e["t"] * fps)
            by_frame[fn] = e
        frames = sorted(by_frame.keys())
        first, last = frames[0], frames[-1]

        interpolated = []
        for fn in range(first, last + 1):
            if fn in by_frame:
                continue
            # Find nearest before and after
            before = max(f for f in frames if f < fn)
            after = min(f for f in frames if f > fn)
            a, b = by_frame[before], by_frame[after]
            frac = (fn - before) / (after - before)
            interpolated.append({
                "t": round(fn / fps, 3),
                "x": int(a["x"] + (b["x"] - a["x"]) * frac),
                "y": int(a["y"] + (b["y"] - a["y"]) * frac),
                "w": int(a["w"] + (b["w"] - a["w"]) * frac),
                "h": int(a["h"] + (b["h"] - a["h"]) * frac),
                "confidence": round(min(a["confidence"], b["confidence"]) * 0.9, 3),
                "interpolated": True,
            })
        track.extend(interpolated)
        track.sort(key=lambda e: e["t"])

    # Also extend tracks a few frames before first and after last detection
    EXTEND = 5
    for track in tracks:
        if not track:
            continue
        first = track[0]
        last = track[-1]
        fn_first = int(first["t"] * fps)
        fn_last = int(last["t"] * fps)
        # Extend before
        for i in range(1, EXTEND + 1):
            fn = fn_first - i
            if fn < 0:
                break
            track.insert(0, {
                "t": round(fn / fps, 3),
                "x": first["x"], "y": first["y"],
                "w": first["w"], "h": first["h"],
                "confidence": round(first["confidence"] * 0.8, 3),
                "interpolated": True,
            })
        # Extend after
        for i in range(1, EXTEND + 1):
            fn = fn_last + i
            if fn >= total_frames:
                break
            track.append({
                "t": round(fn / fps, 3),
                "x": last["x"], "y": last["y"],
                "w": last["w"], "h": last["h"],
                "confidence": round(last["confidence"] * 0.8, 3),
                "interpolated": True,
            })


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_video(video_path, offending_plate="ABC123", every_n=1):
    """Process a video, detect plates, track, OCR once per track."""
    scripts_dir = Path(__file__).parent
    plate_net = load_yolo(scripts_dir, PLATE_MODEL)
    if plate_net is None:
        print("[detect_plates] FATAL: plate model not found", flush=True)
        sys.exit(1)

    # Vehicle model for backstop (optional)
    vehicle_net = load_yolo(scripts_dir, VEHICLE_MODEL)
    if vehicle_net is None:
        print("[detect_plates] NOTE: vehicle model not found, backstop disabled", flush=True)

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
    print(f"[detect_plates]   Conf threshold: {CONF_THRESH}, padding: {PAD_FRAC*100:.0f}%", flush=True)
    print(f"[detect_plates]   Processing every {every_n} frame(s)", flush=True)
    print(f"[detect_plates]   Offending plate: {offending_plate}", flush=True)
    print(f"[detect_plates]   Vehicle backstop: {'ON' if vehicle_net else 'OFF'}", flush=True)

    # ------------------------------------------------------------------
    # Pass 1: detect plates (and vehicles) in every frame
    # ------------------------------------------------------------------
    tracks = []          # list of lists of detection entries
    track_last_pos = []  # last (x, y, w, h) per track
    best_frames = {}     # track_idx -> (area, frame_copy, x, y, w, h)
    backstop_dets = []   # vehicle backstop entries with frame numbers

    frame_num = 0
    total_plate_dets = 0
    total_vehicle_dets = 0
    conf_bins = {"<0.2": 0, "0.2-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, ">0.8": 0}
    t_detect_start = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num % every_n == 0:
            # Plate detection
            raw_plates = detect_yolo(plate_net, frame, CONF_THRESH)
            t_sec = round(frame_num / fps, 3)
            total_plate_dets += len(raw_plates)

            # Apply padding to all plate boxes
            plates = []
            for p in raw_plates:
                px, py, pw, ph = pad_box(p["x"], p["y"], p["w"], p["h"], w, h)
                plates.append({**p, "x": px, "y": py, "w": pw, "h": ph})
                # Confidence distribution
                c = p["confidence"]
                if c < 0.2: conf_bins["<0.2"] += 1
                elif c < 0.4: conf_bins["0.2-0.4"] += 1
                elif c < 0.6: conf_bins["0.4-0.6"] += 1
                elif c < 0.8: conf_bins["0.6-0.8"] += 1
                else: conf_bins[">0.8"] += 1

            # Vehicle backstop detection
            if vehicle_net:
                raw_vehicles = detect_yolo(vehicle_net, frame, VEHICLE_CONF,
                                           num_classes=80)
                vehicles = [v for v in raw_vehicles
                            if v["class_id"] in VEHICLE_CLASSES]
                total_vehicle_dets += len(vehicles)
                bs = vehicle_backstop_plates(vehicles, plates, w, h)
                for b in bs:
                    backstop_dets.append({
                        **b, "t": t_sec, "frame": frame_num,
                    })

            if frame_num % 10 == 0:
                vcount = f", {len(vehicles)} vehicles" if vehicle_net else ""
                print(f"[detect_plates]   frame {frame_num}/{total} — "
                      f"{len(plates)} plates{vcount}", flush=True)

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

                # Keep the largest crop per track for OCR (use original unpadded box)
                area = p["w"] * p["h"]
                if ti not in best_frames or area > best_frames[ti][0]:
                    best_frames[ti] = (area, frame.copy(),
                                       p["x"], p["y"], p["w"], p["h"])

        frame_num += 1

    cap.release()
    t_detect = time.time() - t_detect_start
    print(f"[detect_plates]   Detection done: {frame_num} frames in "
          f"{t_detect:.1f}s ({total_plate_dets} plate dets, {total_vehicle_dets} vehicle dets)", flush=True)
    print(f"[detect_plates]   Confidence dist: {conf_bins}", flush=True)

    # ------------------------------------------------------------------
    # Interpolate tracks to fill gaps
    # ------------------------------------------------------------------
    interpolate_tracks(tracks, frame_num, fps)
    interp_count = sum(1 for t in tracks for e in t if e.get("interpolated"))
    print(f"[detect_plates]   Track interpolation: {interp_count} frames filled", flush=True)

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

    # Add vehicle backstop regions as a separate "track"
    if backstop_dets:
        regions.append({
            "label": "PLATE",
            "plate_text": None,
            "source": "vehicle_backstop",
            "frames": [{
                "t": d["t"], "x": d["x"], "y": d["y"],
                "w": d["w"], "h": d["h"],
                "confidence": d["confidence"],
            } for d in backstop_dets],
        })
        print(f"[detect_plates]   Vehicle backstop: {len(backstop_dets)} plate regions inferred", flush=True)

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
        "duration": round(duration, 3),
        "offending_plate": offending_plate,
        "detection_method": "YOLOv8n (ONNX, OpenCV DNN), conf >= {}, pad {}%".format(CONF_THRESH, int(PAD_FRAC*100)),
        "ocr": "pytesseract (once per track)" if HAS_OCR else "none",
        "vehicle_backstop": vehicle_net is not None,
        "regions": regions,
        "stats": {
            "frames_processed": frame_num // every_n,
            "total_frames": frame_num,
            "tracks_found": len(tracks),
            "backstop_regions": len(backstop_dets),
            "offending_found": sum(1 for r in regions
                                   if r["label"] == "PLATE_OFFENDING"),
            "total_plate_detections": total_plate_dets,
            "total_vehicle_detections": total_vehicle_dets,
            "interpolated_frames": interp_count,
            "confidence_distribution": conf_bins,
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
    parser.add_argument("--every", type=int, default=1,
                        help="Process every Nth frame (default: 1, every frame)")
    args = parser.parse_args()

    result = process_video(args.video, args.offending, args.every)

    # Summary
    print(f"\nResults:", flush=True)
    print(f"  Tracks: {result['stats']['tracks_found']}", flush=True)
    print(f"  Total plate detections: {result['stats']['total_plate_detections']}", flush=True)
    print(f"  Vehicle backstop regions: {result['stats']['backstop_regions']}", flush=True)
    print(f"  Interpolated frames: {result['stats']['interpolated_frames']}", flush=True)
    print(f"  Confidence distribution: {result['stats']['confidence_distribution']}", flush=True)
    offending_found = result["stats"]["offending_found"]
    print(f"  Offending ({args.offending}): "
          f"{'FOUND' if offending_found else 'NOT FOUND'}", flush=True)
    for r in result["regions"]:
        txt = r["plate_text"] or "(unread)"
        src = f" [{r['source']}]" if r.get("source") else ""
        print(f"    [{r['label']}] {txt}: {len(r['frames'])} detections{src}",
              flush=True)

    out_path = (args.output or
                str(Path(__file__).parent / "plate-regions.json"))
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    print(f"\nSaved to {out_path}", flush=True)


if __name__ == "__main__":
    main()
