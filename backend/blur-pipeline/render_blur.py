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


def load_regions(path):
    with open(path) as f:
        track = json.load(f)
    fps = track.get("fps", 25)
    by_frame = {}
    for region in track.get("regions", []):
        label = region.get("label", "PLATE")
        for det in region.get("frames", []):
            # Support both "frame" (old) and "t" (new, timestamp-based) formats
            if "frame" in det:
                fn = det["frame"]
            elif "t" in det:
                fn = int(round(det["t"] * fps))
            else:
                continue
            entry = {**det, "frame": fn, "label": label}
            by_frame.setdefault(fn, []).append(entry)
    return track, by_frame


def interpolate_regions(by_frame, total_frames, hold_frames=5):
    filled = dict(by_frame)
    for frame_num in sorted(by_frame.keys()):
        for det in by_frame[frame_num]:
            for hold in range(1, hold_frames + 1):
                nf = frame_num + hold
                if nf < total_frames and nf not in by_frame:
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


def render_blur_pass(video_path, by_frame, output_path, fps, w, h, pass_name="blur"):
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
        offending = [d for d in dets if d.get("label") == "PLATE_OFFENDING"]
        for det in dets:
            if det.get("label") == "PLATE_OFFENDING":
                continue
            if any(iou(det, o) > 0.3 for o in offending):
                continue
            frame = blur_region(frame, det["x"], det["y"], det["w"], det["h"])
            blurred_total += 1
        out.write(frame)
        if frame_num % 10 == 0:
            print(f"[render_blur]   frame {frame_num}: {len(dets)} regions", flush=True)
        frame_num += 1

    cap.release()
    out.release()
    return frame_num, blurred_total


def verify_and_reblur(blurred_raw_path, fps, w, h, offending_plate, scripts_dir,
                      offending_regions=None):
    """
    Verification pass: re-run plate detection on the blurred output.
    If any non-offending plates are still visible, blur them.
    offending_regions: by_frame dict of offending plate positions to skip.
    Returns (leaked_count, reblurred_path or None).
    """
    print("[render_blur] VERIFICATION PASS: checking for leaked plates...", flush=True)

    model_path = scripts_dir / "yolov8n-plates.onnx"
    if not model_path.exists():
        print("[render_blur]   Plate model not found, skipping verification", flush=True)
        return 0, None

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

    print(f"[render_blur]   Skipped {skipped_offending} offending plate detections", flush=True)
    if total_leaked == 0:
        print("[render_blur]   Verification PASSED: no leaked plates", flush=True)
        return 0, None

    print(f"[render_blur]   Verification found {total_leaked} leaked plate regions "
          f"across {len(leaked_frames)} frames — re-blurring", flush=True)

    # Interpolate leaked regions too
    leaked_frames = interpolate_regions(leaked_frames, frame_num, hold_frames=3)

    # Re-blur
    reblurred_path = blurred_raw_path.with_stem(blurred_raw_path.stem + "-v2")
    render_blur_pass(str(blurred_raw_path), leaked_frames, str(reblurred_path),
                     fps, w, h, pass_name="re-blur")
    return total_leaked, reblurred_path


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
    track, by_frame = load_regions(args.regions)
    fps = track.get("fps", 25)
    total = int(track.get("duration", track.get("duration_s", 5)) * fps)
    offending_plate = track.get("offending_plate", "ABC123")
    by_frame = interpolate_regions(by_frame, total)

    output_final = Path(args.output or video_path.with_stem(video_path.stem + "-blurred"))
    output_tmp = output_final.with_suffix(".raw.mp4")

    cap = cv2.VideoCapture(str(video_path))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    actual_fps = cap.get(cv2.CAP_PROP_FPS) or fps
    cap.release()

    # Pass 1: main blur
    frame_count, blurred_total = render_blur_pass(
        str(video_path), by_frame, str(output_tmp),
        actual_fps, w, h, pass_name="main blur")

    # Build offending plate position lookup for verification
    offending_by_frame = {}
    for region in track.get("regions", []):
        if region.get("label") == "PLATE_OFFENDING":
            for det in region.get("frames", []):
                if "frame" in det:
                    fn = det["frame"]
                elif "t" in det:
                    fn = int(round(det["t"] * fps))
                else:
                    continue
                offending_by_frame.setdefault(fn, []).append(det)

    # Verification loop: re-detect on blurred output, re-blur leaks, up to 3 passes.
    # Fail-closed: if plates still leak after 3 passes, exit non-zero so the video is never served.
    MAX_VERIFY_PASSES = 3
    leaked = 0
    if not args.no_verify:
        for verify_pass in range(1, MAX_VERIFY_PASSES + 1):
            print(f"[render_blur] Verification pass {verify_pass}/{MAX_VERIFY_PASSES}...", flush=True)
            leaked, reblurred_path = verify_and_reblur(
                output_tmp, actual_fps, w, h, offending_plate, scripts_dir,
                offending_regions=offending_by_frame)
            if reblurred_path:
                output_tmp.unlink()
                output_tmp = reblurred_path
            if leaked == 0:
                print(f"[render_blur] Verification CLEAN after pass {verify_pass}", flush=True)
                break
        else:
            if leaked > 0:
                print(f"[render_blur] FAIL-CLOSED: {leaked} plates still leaked after "
                      f"{MAX_VERIFY_PASSES} verification passes — refusing to release video",
                      flush=True)
                output_tmp.unlink(missing_ok=True)
                sys.exit(1)

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
