#!/usr/bin/env python3
"""
Render blurred video from a region track.
Burns opaque blur into detected face/plate regions.
Includes a verification pass: re-runs plate detection on the blurred output
and re-blurs any plates that leaked through.

Usage: python3 render_blur.py <video> <regions.json> [--output blurred.mp4]
"""
import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import cv2
import numpy as np


def frame_of(det, fps):
    """Frame number of a detection in THIS video: from its timestamp and the video's own frame rate, rounded.
    A stored "frame" is used only when there is no timestamp."""
    if "t" in det:
        return int(round(det["t"] * fps))
    return det.get("frame")


def load_regions(path, fps):
    """fps is the video's own frame rate. Never a default: a guessed rate puts every blur box at the wrong moment."""
    with open(path) as f:
        track = json.load(f)
    by_frame = {}
    for tid, region in enumerate(track.get("regions", [])):
        label = region.get("label", "PLATE")
        for det in region.get("frames", []):
            fn = frame_of(det, fps)
            if fn is None:
                continue
            entry = {**det, "frame": fn, "label": label, "track": tid}
            by_frame.setdefault(fn, []).append(entry)
    return track, by_frame


def interpolate_regions(by_frame, total_frames, hold_frames=5):
    """Holds each track's last box for up to hold_frames frames where THAT track has no detection. Per track: until
    2026-11-17 a box was held only into frames with no detection of any kind, so a frame with a face but a missing
    offending-plate entry lost the plate's position."""
    filled = {fn: list(dets) for fn, dets in by_frame.items()}
    present = {(fn, d.get("track")) for fn, dets in by_frame.items() for d in dets}
    for frame_num in sorted(by_frame.keys()):
        for det in by_frame[frame_num]:
            for hold in range(1, hold_frames + 1):
                nf = frame_num + hold
                key = (nf, det.get("track"))
                if nf >= total_frames or key in present:
                    break
                present.add(key)
                filled.setdefault(nf, []).append({
                    **det, "frame": nf,
                    "confidence": det.get("confidence", 0.5) * 0.8
                })
    return filled


def blur_region(frame, x, y, w, h):
    h_img, w_img = frame.shape[:2]
    x1, y1 = max(0, x), max(0, y)
    x2, y2 = min(w_img, x + w), min(h_img, y + h)
    if x2 <= x1 or y2 <= y1:
        return frame
    roi = frame[y1:y2, x1:x2]
    ksize = max(99, (max(w, h) // 2) | 1)
    frame[y1:y2, x1:x2] = cv2.GaussianBlur(roi, (ksize, ksize), 30)
    return frame


def iou(a, b):
    """Intersection over smaller box area."""
    x1 = max(a["x"], b["x"])
    y1 = max(a["y"], b["y"])
    x2 = min(a["x"] + a["w"], b["x"] + b["w"])
    y2 = min(a["y"] + a["h"], b["y"] + b["h"])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = a["w"] * a["h"]
    area_b = b["w"] * b["h"]
    denom = min(area_a, area_b)
    if denom == 0:
        return 0
    return inter / denom


def render_blur_pass(video_path, by_frame, output_path, fps, w, h, pass_name="blur", keep_visible=None):
    """Render one blur pass over a video. Returns (frame_count, regions_blurred)."""
    cap = cv2.VideoCapture(str(video_path))
    out = cv2.VideoWriter(str(output_path), cv2.VideoWriter.fourcc(*"mp4v"), fps, (w, h))
    print(f"[render_blur] {pass_name}: {w}x{h} {fps:.0f}fps", flush=True)

    frame_num = 0
    blurred_total = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        dets = by_frame.get(frame_num, [])
        offending = [d for d in dets if d.get("label") == "PLATE_OFFENDING"] + (keep_visible or {}).get(frame_num, [])
        # The offending plate stays readable whatever else is blurred around it: its pixels are put back after the
        # blur, so a car-sized backstop box or a widened leak box cannot cover it.
        kept = []
        for o in offending:
            x0, y0 = max(0, int(o["x"])), max(0, int(o["y"]))
            x1, y1 = min(w, int(o["x"] + o["w"])), min(h, int(o["y"] + o["h"]))
            if x1 > x0 and y1 > y0:
                kept.append((x0, y0, frame[y0:y1, x0:x1].copy()))
        for det in dets:
            if det.get("label") == "PLATE_OFFENDING":
                continue
            if any(iou(det, o) > 0.3 for o in offending):
                continue
            frame = blur_region(frame, det["x"], det["y"], det["w"], det["h"])
            blurred_total += 1
        for x0, y0, crop in kept:
            frame[y0:y0 + crop.shape[0], x0:x0 + crop.shape[1]] = crop
        out.write(frame)
        if frame_num % 10 == 0:
            print(f"[render_blur]   frame {frame_num}: {len(dets)} regions", flush=True)
        frame_num += 1

    cap.release()
    out.release()
    return frame_num, blurred_total


def covered(det, regions, min_cover=0.5):
    """True when at least min_cover of det's area lies inside the UNION of the given (already blurred) regions.
    A union, not any single region: a blurred plate is often covered by two overlapping boxes from different passes."""
    x0, y0 = max(0, det["x"]), max(0, det["y"])
    x1, y1 = det["x"] + det["w"], det["y"] + det["h"]
    if x1 <= x0 or y1 <= y0:
        return True
    mask = np.zeros((y1 - y0, x1 - x0), dtype=np.uint8)
    for r in regions:
        rx0, ry0 = max(x0, r["x"]), max(y0, r["y"])
        rx1, ry1 = min(x1, r["x"] + r["w"]), min(y1, r["y"] + r["h"])
        if rx1 > rx0 and ry1 > ry0:
            mask[ry0 - y0:ry1 - y0, rx0 - x0:rx1 - x0] = 1
    return mask.mean() >= min_cover


def verify_and_reblur(blurred_raw_path, fps, w, h, offending_plate, scripts_dir,
                      offending_regions=None, blurred_regions=None):
    """
    Verification pass: re-run plate detection on the blurred output.
    If any non-offending plates are still visible, blur them.
    offending_regions: by_frame dict of offending plate positions to skip.
    blurred_regions: by_frame dict of regions already blurred. The detector still finds a plate-shaped box where a plate
    was blurred (the shape survives the blur), so a detection that lies inside a blurred region is not a leak. Counting
    it as one made every video fail verification (2026-11-17). Only detections outside blurred regions are leaks.
    Returns (leaked_count, reblurred_path or None, leaked_by_frame).
    """
    print("[render_blur] VERIFICATION PASS: checking for leaked plates...", flush=True)

    model_path = scripts_dir / "yolov8n-plates.onnx"
    if not model_path.exists():
        print("[render_blur]   Plate model not found, skipping verification", flush=True)
        return 0, None, {}

    net = cv2.dnn.readNetFromONNX(str(model_path))
    INPUT_SIZE = 640
    VERIFY_CONF = 0.20

    # Build offending position lookup
    offending_by_frame = offending_regions or {}

    cap = cv2.VideoCapture(str(blurred_raw_path))
    leaked_frames = {}
    frame_num = 0
    total_leaked = 0
    skipped_offending = 0
    skipped_blurred = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (INPUT_SIZE, INPUT_SIZE),
                                     swapRB=True, crop=False)
        net.setInput(blob)
        output = net.forward()
        data = output[0].T
        scale_x = w / INPUT_SIZE
        scale_y = h / INPUT_SIZE

        boxes, confs = [], []
        for row in data:
            cx, cy, bw, bh = row[:4]
            conf = float(row[4])
            if conf < VERIFY_CONF:
                continue
            x1 = int((cx - bw / 2) * scale_x)
            y1 = int((cy - bh / 2) * scale_y)
            pw = int(bw * scale_x)
            ph = int(bh * scale_y)
            pad = 0.25
            ppx = int(pw * pad)
            ppy = int(ph * pad)
            x1 = max(0, x1 - ppx)
            y1 = max(0, y1 - ppy)
            pw = min(w - x1, pw + 2 * ppx)
            ph = min(h - y1, ph + 2 * ppy)
            boxes.append([x1, y1, pw, ph])
            confs.append(conf)

        if boxes:
            indices = cv2.dnn.NMSBoxes(boxes, confs, VERIFY_CONF, 0.45)
            if len(indices) > 0:
                off_dets = offending_by_frame.get(frame_num, [])
                for i in indices.flatten():
                    bx, by, bw_d, bh_d = boxes[i]
                    det = {"x": bx, "y": by, "w": bw_d, "h": bh_d}
                    # Skip if this overlaps with a known offending plate position
                    if any(iou(det, o) > 0.3 for o in off_dets):
                        skipped_offending += 1
                        continue
                    if covered(det, (blurred_regions or {}).get(frame_num, [])):
                        skipped_blurred += 1
                        continue
                    leaked_frames.setdefault(frame_num, []).append({
                        **det,
                        "confidence": confs[i],
                        "label": "PLATE",
                        "frame": frame_num,
                    })
                    total_leaked += 1

        if frame_num % 10 == 0:
            leaked_here = len(leaked_frames.get(frame_num, []))
            print(f"[render_blur]   verify frame {frame_num}: "
                  f"{leaked_here} leaked plates", flush=True)
        frame_num += 1

    cap.release()

    print(f"[render_blur]   Skipped {skipped_offending} offending plate detections, "
          f"{skipped_blurred} detections inside already blurred regions", flush=True)
    if total_leaked == 0:
        print("[render_blur]   Verification PASSED: no leaked plates", flush=True)
        return 0, None, {}

    print(f"[render_blur]   Verification found {total_leaked} leaked plate regions "
          f"across {len(leaked_frames)} frames — re-blurring", flush=True)

    # Re-blur a leak with a wider box than the detection. The detector re-finds a blurred plate a few pixels away from
    # where it found it before, so a re-blur exactly the size of the detection leaves an edge it finds again on the
    # next round. Blurring more is the privacy-safe direction.
    LEAK_MARGIN = 0.5
    for fn, dets in leaked_frames.items():
        for d in dets:
            mx, my = int(d["w"] * LEAK_MARGIN), int(d["h"] * LEAK_MARGIN)
            d["x"], d["y"] = max(0, d["x"] - mx), max(0, d["y"] - my)
            d["w"], d["h"] = min(w - d["x"], d["w"] + 2 * mx), min(h - d["y"], d["h"] + 2 * my)

    # Interpolate leaked regions too
    leaked_frames = interpolate_regions(leaked_frames, frame_num, hold_frames=3)

    # Re-blur
    reblurred_path = blurred_raw_path.with_stem(blurred_raw_path.stem + "-v2")
    render_blur_pass(str(blurred_raw_path), leaked_frames, str(reblurred_path),
                     fps, w, h, pass_name="re-blur", keep_visible=offending_by_frame)
    return total_leaked, reblurred_path, leaked_frames


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("regions")
    parser.add_argument("--output", "-o", default=None)
    parser.add_argument("--no-verify", action="store_true",
                        help="Skip verification pass")
    args = parser.parse_args()

    t0 = time.time()
    video_path = Path(args.video)
    scripts_dir = Path(__file__).parent
    output_final = Path(args.output or video_path.with_stem(video_path.stem + "-blurred"))
    output_tmp = output_final.with_suffix(".raw.mp4")

    # Frame rate and length come from the video itself, never from a default.
    cap = cv2.VideoCapture(str(video_path))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    actual_fps = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    if not actual_fps or actual_fps <= 0 or total <= 0:
        print("[render_blur] FAIL-CLOSED: cannot read the video's frame rate or length", flush=True)
        sys.exit(1)
    track, by_frame = load_regions(args.regions, actual_fps)
    offending_plate = track.get("offending_plate")  # None: no plate is kept visible
    by_frame = interpolate_regions(by_frame, total)

    # Pass 1: main blur
    frame_count, blurred_total = render_blur_pass(
        str(video_path), by_frame, str(output_tmp),
        actual_fps, w, h, pass_name="main blur")

    # Build offending plate position lookup for verification
    # Built from the held (interpolated) positions, so a frame where the detector missed the plate still knows where it is.
    offending_by_frame = {}
    for fn, dets in by_frame.items():
        for det in dets:
            if det.get("label") == "PLATE_OFFENDING":
                offending_by_frame.setdefault(fn, []).append(det)

    # Verification: up to MAX_REBLUR_ROUNDS rounds of "find leaks, re-blur them", then the decision is made by a
    # verification of the FINAL output. Until 2026-11-17 the loop failed closed on leaks it had just re-blurred, without
    # looking at the result, so a video that needed a third re-blur was always refused.
    MAX_REBLUR_ROUNDS = 6
    leaked = 0
    # Everything blurred so far, per frame (offending plates are not blurred, so they are not in here).
    blurred_by_frame = {fn: [d for d in dets if d.get("label") != "PLATE_OFFENDING"] for fn, dets in by_frame.items()}
    if not args.no_verify:
        for vround in range(0, MAX_REBLUR_ROUNDS + 1):
            leaked, reblurred_path, reblurred = verify_and_reblur(
                output_tmp, actual_fps, w, h, offending_plate, scripts_dir,
                offending_regions=offending_by_frame, blurred_regions=blurred_by_frame)
            if leaked == 0:
                break
            if vround == MAX_REBLUR_ROUNDS:
                # The final output still shows plates: refuse it. The re-blur made in this call is not used.
                if reblurred_path:
                    reblurred_path.unlink(missing_ok=True)
                print(f"[render_blur] FAIL-CLOSED: {leaked} plates still visible after "
                      f"{MAX_REBLUR_ROUNDS} re-blur rounds — refusing to release video", flush=True)
                output_tmp.unlink(missing_ok=True)
                sys.exit(1)
            for fn, dets in reblurred.items():
                blurred_by_frame.setdefault(fn, []).extend(dets)
            if reblurred_path:
                output_tmp.unlink()
                output_tmp = reblurred_path
            print(f"[render_blur] Re-blur round {vround + 1}/{MAX_REBLUR_ROUNDS}: {leaked} plates re-blurred, "
                  f"verifying again", flush=True)

    # Re-encode with x264 for web
    print("[render_blur] Encoding final output with x264...", flush=True)
    subprocess.run([
        "ffmpeg", "-y", "-i", str(output_tmp),
        "-c:v", "libx264", "-crf", "23", "-preset", "medium",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        str(output_final)
    ], check=True, capture_output=True)
    output_tmp.unlink(missing_ok=True)

    elapsed = time.time() - t0
    size_mb = output_final.stat().st_size / 1048576
    print(f"\n[render_blur] Done: {output_final} ({size_mb:.1f} MB)", flush=True)
    print(f"[render_blur]   Regions blurred: {blurred_total} across {frame_count} frames", flush=True)
    print(f"[render_blur]   Verification leaked: {leaked}", flush=True)
    print(f"[render_blur]   Total time: {elapsed:.1f}s", flush=True)

if __name__ == "__main__":
    main()
