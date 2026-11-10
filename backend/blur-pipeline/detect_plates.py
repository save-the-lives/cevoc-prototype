#!/usr/bin/env python3
"""
Plate detection for the CEVOC blurring pipeline spike.

Uses contour-based detection (no AGPL models):
1. Convert frame to grayscale
2. Apply bilateral filter + adaptive threshold to find high-contrast regions
3. Find contours with plate-like aspect ratio (2:1 to 6:1)
4. Filter by size, aspect ratio, and solidity
5. OCR each candidate with tesseract to read plate text
6. Label ABC123 as PLATE_OFFENDING (keep visible), others as PLATE (blur)

Output: JSON region track compatible with ADR 0017.

Usage: python3 detect_plates.py <video.mp4> [--offending ABC123] [--output regions.json]
"""
import argparse
import json
import sys
import time
from collections import defaultdict
from pathlib import Path

import cv2
import numpy as np

try:
    import pytesseract
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


def preprocess_for_plates(frame):
    """Produce several binary images optimised for plate-like rectangles."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    # Bilateral keeps edges while smoothing noise
    blur = cv2.bilateralFilter(gray, 11, 17, 17)

    candidates = []

    # Method 1: adaptive threshold
    thresh1 = cv2.adaptiveThreshold(blur, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                     cv2.THRESH_BINARY_INV, 19, 5)
    candidates.append(thresh1)

    # Method 2: Canny edges + dilation to close gaps
    edges = cv2.Canny(blur, 30, 200)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 3))
    dilated = cv2.dilate(edges, kernel, iterations=2)
    candidates.append(dilated)

    # Method 3: blackhat (finds dark objects on light backgrounds — plates on car bodies)
    rect_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (13, 5))
    blackhat = cv2.morphologyEx(gray, cv2.MORPH_BLACKHAT, rect_kernel)
    _, bh_thresh = cv2.threshold(blackhat, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)
    candidates.append(bh_thresh)

    return candidates, gray


def find_plate_contours(binary, frame_h, frame_w, min_plate_w=40, max_plate_w_ratio=0.45):
    """Find contours that look like plates: rectangular, right aspect ratio, right size."""
    contours, _ = cv2.findContours(binary, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)
    plates = []
    max_plate_w = int(frame_w * max_plate_w_ratio)

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 300:
            continue

        # Approximate the contour to a polygon
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        # Plates are roughly rectangular (4-6 vertices after approximation)
        if len(approx) < 4 or len(approx) > 8:
            continue

        x, y, w, h = cv2.boundingRect(cnt)

        # Aspect ratio filter: plates are wider than tall (2:1 to 6:1)
        if h == 0:
            continue
        ar = w / h
        if ar < 1.8 or ar > 6.5:
            continue

        # Size filter
        if w < min_plate_w or w > max_plate_w or h < 12 or h > frame_h * 0.15:
            continue

        # Solidity: plate contours should be fairly solid (filled)
        hull = cv2.convexHull(cnt)
        hull_area = cv2.contourArea(hull)
        if hull_area == 0:
            continue
        solidity = area / hull_area
        if solidity < 0.4:
            continue

        # Confidence based on how plate-like the shape is
        # Best: aspect ratio near 3.5, solidity near 1.0, approx has 4 vertices
        ar_score = 1.0 - min(abs(ar - 3.5) / 3.0, 1.0)
        sol_score = solidity
        vert_score = 1.0 if len(approx) == 4 else 0.7
        confidence = (ar_score * 0.4 + sol_score * 0.3 + vert_score * 0.3)

        plates.append({
            "x": x, "y": y, "w": w, "h": h,
            "confidence": round(confidence, 3),
            "contour": cnt
        })

    return plates


def ocr_plate(gray, x, y, w, h, pad=5):
    """Try to read plate text from the region using tesseract."""
    if not HAS_OCR:
        return None

    fh, fw = gray.shape
    # Pad the region slightly
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(fw, x + w + pad)
    y2 = min(fh, y + h + pad)
    roi = gray[y1:y2, x1:x2]

    if roi.size == 0:
        return None

    # Upscale for better OCR
    scale = max(1, 80 // max(roi.shape[0], 1))
    if scale > 1:
        roi = cv2.resize(roi, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Sharpen + threshold
    roi = cv2.GaussianBlur(roi, (3, 3), 0)
    _, roi = cv2.threshold(roi, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)

    # OCR with plate-friendly config
    config = "--psm 7 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    try:
        text = pytesseract.image_to_string(roi, config=config).strip()
        # Clean: remove spaces, newlines
        text = "".join(c for c in text if c.isalnum())
        return text if len(text) >= 3 else None
    except Exception:
        return None


def deduplicate_plates(plates, overlap_thresh=0.5):
    """Remove overlapping detections, keeping the highest confidence."""
    if not plates:
        return []
    plates.sort(key=lambda p: p["confidence"], reverse=True)
    kept = []
    for p in plates:
        overlap = False
        for k in kept:
            # IoU check
            x1 = max(p["x"], k["x"])
            y1 = max(p["y"], k["y"])
            x2 = min(p["x"] + p["w"], k["x"] + k["w"])
            y2 = min(p["y"] + p["h"], k["y"] + k["h"])
            inter = max(0, x2 - x1) * max(0, y2 - y1)
            area_p = p["w"] * p["h"]
            area_k = k["w"] * k["h"]
            union = area_p + area_k - inter
            if union > 0 and inter / union > overlap_thresh:
                overlap = True
                break
        if not overlap:
            kept.append(p)
    return kept


def detect_plates_in_frame(frame, gray):
    """Run all detection methods and merge results."""
    h, w = frame.shape[:2]
    binaries, _ = preprocess_for_plates(frame)

    all_plates = []
    for binary in binaries:
        all_plates.extend(find_plate_contours(binary, h, w))

    # Deduplicate
    plates = deduplicate_plates(all_plates)

    # OCR each plate
    for p in plates:
        text = ocr_plate(gray, p["x"], p["y"], p["w"], p["h"])
        p["plate_text"] = text
        # Drop the contour (not serializable)
        p.pop("contour", None)

    return plates


def process_video(video_path, offending_plate="ABC123", every_n=2):
    """Process a video, detect plates in every Nth frame, return region track."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"Error: cannot open {video_path}", file=sys.stderr)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total / fps
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    print(f"Video: {video_path}")
    print(f"  {w}x{h}, {fps} fps, {total} frames, {duration:.1f}s")
    print(f"  Processing every {every_n}th frame")
    print(f"  Offending plate: {offending_plate}")
    print(f"  OCR: {'yes' if HAS_OCR else 'no (pytesseract not available)'}")
    print()

    # Track detections keyed by approximate plate identity (position cluster)
    all_detections = []  # list of (frame_num, time_s, plates)
    frame_num = 0
    t0 = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num % every_n == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            plates = detect_plates_in_frame(frame, gray)
            t_sec = round(frame_num / fps, 3)
            if plates:
                all_detections.append((frame_num, t_sec, plates))

        frame_num += 1

    cap.release()
    elapsed = time.time() - t0
    print(f"Processed {frame_num} frames in {elapsed:.1f}s ({frame_num/max(elapsed,0.01):.0f} fps)")

    # Cluster detections into tracks by spatial proximity across frames
    tracks = []  # each track: list of (t, x, y, w, h, confidence, plate_text)
    track_last_pos = []  # last known (x, y, w, h) per track

    for frame_num, t_sec, plates in all_detections:
        used = set()
        for p in plates:
            cx, cy = p["x"] + p["w"] // 2, p["y"] + p["h"] // 2
            best_track = None
            best_dist = float("inf")
            for ti, (lx, ly, lw, lh) in enumerate(track_last_pos):
                lcx, lcy = lx + lw // 2, ly + lh // 2
                dist = ((cx - lcx) ** 2 + (cy - lcy) ** 2) ** 0.5
                if dist < max(p["w"], lw) * 2 and dist < best_dist and ti not in used:
                    best_dist = dist
                    best_track = ti

            entry = {
                "t": t_sec,
                "x": p["x"], "y": p["y"], "w": p["w"], "h": p["h"],
                "confidence": p["confidence"],
                "plate_text": p.get("plate_text")
            }

            if best_track is not None:
                tracks[best_track].append(entry)
                track_last_pos[best_track] = (p["x"], p["y"], p["w"], p["h"])
                used.add(best_track)
            else:
                tracks.append([entry])
                track_last_pos.append((p["x"], p["y"], p["w"], p["h"]))

    # Build region track output
    regions = []
    offending_norm = offending_plate.replace(" ", "").upper()

    for track in tracks:
        if not track:
            continue

        # Determine plate text by majority vote
        texts = [e["plate_text"] for e in track if e["plate_text"]]
        plate_text = None
        if texts:
            from collections import Counter
            plate_text = Counter(texts).most_common(1)[0][0]

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
                "confidence": e["confidence"]
            })

        regions.append({
            "label": label,
            "plate_text": plate_text,
            "frames": frames
        })

    result = {
        "v": 1,
        "video": str(video_path),
        "resolution": f"{w}x{h}",
        "fps": fps,
        "duration_s": round(duration, 3),
        "offending_plate": offending_plate,
        "detection_method": "contour-based (OpenCV, no AGPL models)",
        "ocr": "tesseract" if HAS_OCR else "none",
        "regions": regions,
        "stats": {
            "frames_processed": frame_num // every_n,
            "total_frames": frame_num,
            "tracks_found": len(regions),
            "offending_found": sum(1 for r in regions if r["label"] == "PLATE_OFFENDING"),
            "processing_time_s": round(elapsed, 1)
        }
    }

    return result


def main():
    parser = argparse.ArgumentParser(description="Detect licence plates in traffic camera video")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--offending", default="ABC123", help="Offending plate text (default: ABC123)")
    parser.add_argument("--output", default=None, help="Output JSON file (default: stdout + plate-regions.json)")
    parser.add_argument("--every", type=int, default=2, help="Process every Nth frame (default: 2)")
    args = parser.parse_args()

    result = process_video(args.video, args.offending, args.every)

    # Print summary
    print(f"\nResults:")
    print(f"  Tracks found: {result['stats']['tracks_found']}")
    print(f"  Offending plate (ABC123): {'FOUND' if result['stats']['offending_found'] > 0 else 'NOT FOUND'}")
    for r in result["regions"]:
        txt = r["plate_text"] or "(unread)"
        print(f"    [{r['label']}] {txt}: {len(r['frames'])} detections")

    # Save
    out_path = args.output or str(Path(__file__).parent / "plate-regions.json")
    with open(out_path, "w") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    print(f"\nSaved to {out_path}")


if __name__ == "__main__":
    main()
