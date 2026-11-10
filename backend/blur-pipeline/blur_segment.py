#!/usr/bin/env python3
"""
Blur a single HLS segment (.ts) using pre-computed region tracks.
Reads the merged regions JSON, filters to the segment's time range,
and applies blur to matching frames.

Usage: python3 blur_segment.py <segment.ts> <merged-regions.json> --output <blurred.ts>
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2
import numpy as np


def load_regions_for_range(path, t_start, t_end):
    """Load regions that fall within [t_start, t_end) seconds."""
    with open(path) as f:
        track = json.load(f)

    by_frame_time = {}
    for region in track.get("regions", []):
        label = region.get("label", "FACE")
        for det in region.get("frames", []):
            t = det.get("t", 0)
            if t_start <= t < t_end:
                rel_t = t - t_start
                by_frame_time.setdefault(round(rel_t, 4), []).append({
                    **det,
                    "label": det.get("label", label),
                    "rel_t": rel_t,
                })
    return by_frame_time


def iou_overlap(a, b):
    """Overlap relative to the smaller box."""
    x1 = max(a["x"], b["x"])
    y1 = max(a["y"], b["y"])
    x2 = min(a["x"] + a["w"], b["x"] + b["w"])
    y2 = min(a["y"] + a["h"], b["y"] + b["h"])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = a["w"] * a["h"]
    area_b = b["w"] * b["h"]
    if area_a + area_b - inter == 0:
        return 0
    return inter / min(area_a, area_b)


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
    parser = argparse.ArgumentParser(description="Blur a single HLS segment")
    parser.add_argument("segment", help="Input .ts segment file")
    parser.add_argument("regions", help="Merged regions JSON (full video)")
    parser.add_argument("--output", "-o", required=True, help="Output blurred .ts file")
    parser.add_argument("--t-start", type=float, default=0, help="Segment start time in seconds")
    parser.add_argument("--t-end", type=float, default=None, help="Segment end time in seconds")
    args = parser.parse_args()

    segment_path = Path(args.segment)
    output_path = Path(args.output)

    # Probe the segment duration if t_end not given
    if args.t_end is None:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(segment_path)],
            capture_output=True, text=True
        )
        try:
            duration = float(result.stdout.strip())
        except ValueError:
            duration = 2.0
        t_end = args.t_start + duration
    else:
        t_end = args.t_end

    regions = load_regions_for_range(args.regions, args.t_start, t_end)

    if not regions:
        # No regions in this segment — copy through unchanged
        import shutil
        shutil.copy2(str(segment_path), str(output_path))
        print(f"Segment {segment_path.name}: no regions, copied through")
        return

    # Decode segment to raw frames, blur, re-encode
    with tempfile.TemporaryDirectory(prefix="blur-seg-") as tmp:
        tmp = Path(tmp)
        raw_mp4 = tmp / "raw.mp4"

        # Convert .ts to .mp4 for OpenCV compatibility
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(segment_path), "-c:v", "copy", "-an", str(raw_mp4)],
            capture_output=True, check=True
        )

        cap = cv2.VideoCapture(str(raw_mp4))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

        blurred_mp4 = tmp / "blurred.mp4"
        out = cv2.VideoWriter(str(blurred_mp4), cv2.VideoWriter.fourcc(*"mp4v"), fps, (w, h))

        frame_num = 0
        blurred_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            t = round(frame_num / fps, 4)
            dets = regions.get(t, [])

            # Also check nearby times (within half a frame)
            if not dets:
                half_frame = 0.5 / fps
                for rt, d in regions.items():
                    if abs(rt - t) < half_frame:
                        dets = d
                        break

            if dets:
                offending = [d for d in dets if d.get("label") == "PLATE_OFFENDING"]
                for det in dets:
                    if det.get("label") == "PLATE_OFFENDING":
                        continue
                    if any(iou_overlap(det, o) > 0.3 for o in offending):
                        continue
                    frame = blur_region(frame, det["x"], det["y"], det["w"], det["h"])
                    blurred_count += 1

            out.write(frame)
            frame_num += 1

        cap.release()
        out.release()

        # Re-encode to .ts
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(blurred_mp4),
             "-c:v", "libx264", "-crf", "23", "-preset", "fast",
             "-pix_fmt", "yuv420p", "-an",
             "-f", "mpegts", str(output_path)],
            capture_output=True, check=True
        )

    print(f"Segment {segment_path.name}: {blurred_count} regions blurred across {frame_num} frames")


if __name__ == "__main__":
    main()
