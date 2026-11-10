#!/usr/bin/env python3
"""
Render blurred video from a region track.
Burns opaque blur into detected face/plate regions.

Usage: python3 render_blur.py <video> <regions.json> [--output blurred.mp4]
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np


def load_regions(path):
    with open(path) as f:
        track = json.load(f)
    by_frame = {}
    for region in track.get("regions", []):
        for det in region.get("frames", []):
            by_frame.setdefault(det["frame"], []).append(det)
    return track, by_frame


def interpolate_regions(by_frame, total_frames, hold_frames=3):
    filled = dict(by_frame)
    for frame_num in sorted(by_frame.keys()):
        for det in by_frame[frame_num]:
            for hold in range(1, hold_frames + 1):
                nf = frame_num + hold
                if nf < total_frames and nf not in by_frame:
                    filled.setdefault(nf, []).append({
                        **det, "frame": nf,
                        "confidence": det["confidence"] * 0.8
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("regions")
    parser.add_argument("--output", "-o", default=None)
    args = parser.parse_args()

    video_path = Path(args.video)
    track, by_frame = load_regions(args.regions)
    total = int(track.get("duration", 5) * track.get("fps", 12))
    by_frame = interpolate_regions(by_frame, total)

    output_raw = Path(args.output or video_path.with_stem(video_path.stem + "-blurred"))
    output_tmp = output_raw.with_suffix(".raw.mp4")

    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    out = cv2.VideoWriter(str(output_tmp), cv2.VideoWriter.fourcc(*"mp4v"), fps, (w, h))
    print(f"Rendering blurred video: {w}x{h} {fps:.0f}fps")

    frame_num = 0
    blurred_total = 0

    def iou(a, b):
        """Intersection over union of two boxes (x,y,w,h)."""
        x1 = max(a["x"], b["x"])
        y1 = max(a["y"], b["y"])
        x2 = min(a["x"] + a["w"], b["x"] + b["w"])
        y2 = min(a["y"] + a["h"], b["y"] + b["h"])
        inter = max(0, x2 - x1) * max(0, y2 - y1)
        area_a = a["w"] * a["h"]
        area_b = b["w"] * b["h"]
        if area_a + area_b - inter == 0:
            return 0
        return inter / min(area_a, area_b)  # overlap relative to the smaller box

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        dets = by_frame.get(frame_num, [])
        # Collect offending plate regions for this frame
        offending = [d for d in dets if d.get("label") == "PLATE_OFFENDING"]
        for det in dets:
            if det.get("label") == "PLATE_OFFENDING":
                continue  # keep the offending plate visible
            # Skip if this region overlaps significantly with an offending plate
            if any(iou(det, o) > 0.3 for o in offending):
                continue
            frame = blur_region(frame, det["x"], det["y"], det["w"], det["h"])
            blurred_total += 1
        out.write(frame)
        if frame_num % 10 == 0:
            print(f"  Frame {frame_num}: {len(by_frame.get(frame_num, []))} regions")
        frame_num += 1

    cap.release()
    out.release()

    # Re-encode with x264 for web
    subprocess.run([
        "ffmpeg", "-y", "-i", str(output_tmp),
        "-c:v", "libx264", "-crf", "23", "-preset", "medium",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
        str(output_raw)
    ], check=True, capture_output=True)
    output_tmp.unlink()

    size_mb = output_raw.stat().st_size / 1048576
    print(f"\nDone: {output_raw} ({size_mb:.1f} MB)")
    print(f"  Regions blurred: {blurred_total} across {frame_num} frames")

if __name__ == "__main__":
    main()
