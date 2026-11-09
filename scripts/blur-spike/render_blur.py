#!/usr/bin/env python3
"""
Blur renderer: takes a video and region track JSONs, renders a blurred version.

Usage:
    python3 render_blur.py <input.mp4> <output.mp4> [--faces faces.json] [--plates plates.json]

Region track JSON format:
{
  "v": 1,
  "regions": [
    {
      "id": "face-1",
      "label": "FACE",          // FACE, PLATE, or PLATE_OFFENDING (kept visible)
      "keys": [
        {"t": 0.5, "x": 0.4, "y": 0.2, "w": 0.08, "h": 0.12},
        {"t": 2.0, "x": 0.42, "y": 0.22, "w": 0.08, "h": 0.12}
      ]
    }
  ]
}

Coordinates are normalised (0-1) relative to frame dimensions.
Keyframes are interpolated linearly for intermediate times.
Regions are padded by 20% and blurred with a heavy Gaussian.
PLATE_OFFENDING regions are skipped (the offending vehicle's plate stays visible).
Audio is stripped (privacy).
"""

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
import time

import cv2
import numpy as np


# ── Region interpolation ────────────────────────────────────────────────────

def lerp(a, b, t):
    return a + (b - a) * t


def interpolate_region(keys, t):
    """
    Given sorted keyframes, interpolate the box at time t.
    Returns (x, y, w, h) in normalised coords, or None if t is outside
    the region's active window (with 0.1s hysteresis before first / after last).
    """
    if not keys:
        return None

    HYSTERESIS = 0.1  # seconds before first and after last keyframe

    first_t = keys[0]["t"]
    last_t = keys[-1]["t"]

    if t < first_t - HYSTERESIS or t > last_t + HYSTERESIS:
        return None

    # Clamp to first/last keyframe if in hysteresis zone
    if t <= first_t:
        k = keys[0]
        return (k["x"], k["y"], k["w"], k["h"])
    if t >= last_t:
        k = keys[-1]
        return (k["x"], k["y"], k["w"], k["h"])

    # Find the two bracketing keyframes
    for i in range(len(keys) - 1):
        if keys[i]["t"] <= t <= keys[i + 1]["t"]:
            k0, k1 = keys[i], keys[i + 1]
            span = k1["t"] - k0["t"]
            frac = (t - k0["t"]) / span if span > 0 else 0
            return (
                lerp(k0["x"], k1["x"], frac),
                lerp(k0["y"], k1["y"], frac),
                lerp(k0["w"], k1["w"], frac),
                lerp(k0["h"], k1["h"], frac),
            )

    # Fallback: use last keyframe
    k = keys[-1]
    return (k["x"], k["y"], k["w"], k["h"])


# ── Blur application ────────────────────────────────────────────────────────

BLUR_KERNEL = 99  # Must be odd; heavy blur
PAD_FACTOR = 0.20  # 20% padding around each region


def apply_blur(frame, x_norm, y_norm, w_norm, h_norm):
    """Apply a heavy Gaussian blur to a padded bounding box on the frame."""
    fh, fw = frame.shape[:2]

    # Convert normalised to pixel coords
    cx = x_norm * fw
    cy = y_norm * fh
    bw = w_norm * fw
    bh = h_norm * fh

    # Pad
    pad_w = bw * PAD_FACTOR
    pad_h = bh * PAD_FACTOR

    x1 = max(0, int(cx - bw / 2 - pad_w))
    y1 = max(0, int(cy - bh / 2 - pad_h))
    x2 = min(fw, int(cx + bw / 2 + pad_w))
    y2 = min(fh, int(cy + bh / 2 + pad_h))

    if x2 <= x1 or y2 <= y1:
        return

    roi = frame[y1:y2, x1:x2]
    blurred = cv2.GaussianBlur(roi, (BLUR_KERNEL, BLUR_KERNEL), 30)
    frame[y1:y2, x1:x2] = blurred


# ── Watermark ────────────────────────────────────────────────────────────────

def add_watermark(frame, text="BLURRED — SYNTHETIC TEST"):
    """Add a semi-transparent watermark at top-left."""
    overlay = frame.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX
    scale = 0.6
    thickness = 2
    (tw, th), baseline = cv2.getTextSize(text, font, scale, thickness)

    # Background rectangle
    cv2.rectangle(overlay, (8, 8), (tw + 20, th + baseline + 16), (0, 0, 0), -1)
    cv2.putText(overlay, text, (14, th + 12), font, scale, (0, 255, 0), thickness, cv2.LINE_AA)

    # Blend
    cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)


# ── Main pipeline ────────────────────────────────────────────────────────────

def load_regions(path):
    """Load a region track JSON file. Returns list of region dicts."""
    if not path or not os.path.exists(path):
        return []
    with open(path) as f:
        data = json.load(f)
    return data.get("regions", [])


def render(input_path, output_path, face_path, plate_path):
    t0 = time.time()

    # Load regions
    regions = []
    for path in [face_path, plate_path]:
        regions.extend(load_regions(path))

    # Filter out PLATE_OFFENDING (those stay visible)
    blur_regions = [r for r in regions if r.get("label") != "PLATE_OFFENDING"]
    keep_regions = [r for r in regions if r.get("label") == "PLATE_OFFENDING"]

    print(f"Regions to blur: {len(blur_regions)}")
    print(f"Regions to keep (offending plate): {len(keep_regions)}")

    # Open video
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"Error: cannot open {input_path}", file=sys.stderr)
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"Input: {width}x{height}, {fps:.1f} fps, {total_frames} frames, {duration:.1f}s")

    # Write to a temp file (raw), then re-encode with FFmpeg
    tmp = tempfile.NamedTemporaryFile(suffix=".avi", delete=False)
    tmp_path = tmp.name
    tmp.close()

    fourcc = cv2.VideoWriter_fourcc(*"MJPG")
    writer = cv2.VideoWriter(tmp_path, fourcc, fps, (width, height))

    frame_idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        t = frame_idx / fps if fps > 0 else 0

        # Apply blur to each active region
        for region in blur_regions:
            box = interpolate_region(region.get("keys", []), t)
            if box:
                apply_blur(frame, *box)

        add_watermark(frame)
        writer.write(frame)

        frame_idx += 1
        if frame_idx % 10 == 0:
            pct = frame_idx / total_frames * 100 if total_frames else 0
            print(f"\r  Processing: {frame_idx}/{total_frames} ({pct:.0f}%)", end="", flush=True)

    cap.release()
    writer.release()
    print(f"\n  OpenCV pass: {frame_idx} frames in {time.time() - t0:.1f}s")

    # Re-encode with FFmpeg for proper H.264
    t1 = time.time()
    cmd = [
        "ffmpeg", "-y",
        "-i", tmp_path,
        "-an",  # strip audio
        "-c:v", "libx264",
        "-crf", "23",
        "-preset", "medium",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"FFmpeg error:\n{result.stderr}", file=sys.stderr)
        sys.exit(1)

    os.unlink(tmp_path)

    size_mb = os.path.getsize(output_path) / 1048576
    total_time = time.time() - t0
    print(f"  FFmpeg re-encode: {time.time() - t1:.1f}s")
    print(f"\nDone: {output_path}")
    print(f"Size: {size_mb:.1f} MB")
    print(f"Total time: {total_time:.1f}s ({total_time / duration:.1f}x realtime)" if duration > 0 else "")


# ── CLI ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Blur faces and plates in a video")
    parser.add_argument("input", help="Input video path")
    parser.add_argument("output", help="Output video path")
    parser.add_argument("--faces", help="Face regions JSON", default=None)
    parser.add_argument("--plates", help="Plate regions JSON", default=None)
    args = parser.parse_args()

    render(args.input, args.output, args.faces, args.plates)


if __name__ == "__main__":
    main()
