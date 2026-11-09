#!/usr/bin/env python3
"""
Face detection on traffic camera video using InsightFace (RetinaFace).
Produces a JSON region track for the blurring pipeline.

Usage: python3 detect_faces.py <video-path> [--output face-regions.json] [--every N]

NOTE: InsightFace pretrained weights are non-commercial (see ADR 0017).
For production, replace with YuNet (MIT) or a licence-cleared model.
This is the spike/baseline only.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import numpy as np
import insightface


def pad_box(x, y, w, h, pad_factor, img_w, img_h):
    pw = int(w * pad_factor / 2)
    ph = int(h * pad_factor / 2)
    return max(0, x - pw), max(0, y - ph), min(img_w - max(0, x - pw), w + 2*pw), min(img_h - max(0, y - ph), h + 2*ph)


def main():
    parser = argparse.ArgumentParser(description="Detect faces in traffic camera video")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--output", "-o", default=None)
    parser.add_argument("--every", type=int, default=2, help="Process every Nth frame (default: 2)")
    parser.add_argument("--pad", type=float, default=0.3, help="Padding factor (default: 0.3)")
    parser.add_argument("--conf", type=float, default=0.3, help="Confidence threshold (default: 0.3)")
    args = parser.parse_args()

    video_path = Path(args.video)
    if not video_path.exists():
        print(f"Error: {video_path} not found", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output) if args.output else Path(__file__).parent / "face-regions.json"

    # Init InsightFace
    print("Loading InsightFace model...")
    app = insightface.app.FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=-1, det_size=(640, 640))
    print("  Model ready")

    # Open video
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"\nVideo: {video_path.name}")
    print(f"  {width}x{height}, {fps:.1f} fps, {total_frames} frames, {duration:.1f}s")
    print(f"  Processing every {args.every} frame(s), confidence >= {args.conf}")
    print()

    all_detections = []
    frame_num = 0
    processed = 0
    frame_times = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num % args.every == 0:
            t0 = time.monotonic()
            t_sec = round(frame_num / fps, 3) if fps > 0 else 0

            faces = app.get(frame)

            for face in faces:
                if face.det_score < args.conf:
                    continue
                bbox = face.bbox.astype(int)
                x, y = int(bbox[0]), int(bbox[1])
                w, h = int(bbox[2] - bbox[0]), int(bbox[3] - bbox[1])
                px, py, pw, ph = pad_box(x, y, w, h, args.pad, width, height)
                all_detections.append({
                    "t": t_sec, "frame": frame_num, "label": "FACE",
                    "x": px, "y": py, "w": pw, "h": ph,
                    "confidence": round(float(face.det_score), 3)
                })

            elapsed = time.monotonic() - t0
            frame_times.append(elapsed)
            processed += 1

            n_f = len([f for f in faces if f.det_score >= args.conf])
            print(f"  Frame {frame_num:3d} t={t_sec:.3f}s: {n_f} face(s) ({elapsed*1000:.0f}ms)")

        frame_num += 1

    cap.release()

    # Build region track
    track = {
        "v": 1,
        "video": str(video_path.name),
        "width": width,
        "height": height,
        "fps": fps,
        "duration": round(duration, 3),
        "processed_frames": processed,
        "every_n": args.every,
        "pad_factor": args.pad,
        "detectors": ["insightface_retinaface_buffalo_l"],
        "note": "Spike baseline. InsightFace weights are non-commercial — replace with YuNet (MIT) for production.",
        "regions": [
            {"id": i, "label": d["label"], "frames": [d]}
            for i, d in enumerate(all_detections)
        ]
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(track, f, indent=2)
        f.write("\n")

    avg_ms = sum(frame_times) * 1000 / len(frame_times) if frame_times else 0
    print(f"\nResults:")
    print(f"  Total face detections: {len(all_detections)}")
    print(f"  Frames processed: {processed}/{total_frames}")
    print(f"  Avg detection time: {avg_ms:.1f}ms per frame")
    print(f"  Output: {output_path}")


if __name__ == "__main__":
    main()
