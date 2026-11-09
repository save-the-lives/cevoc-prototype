#!/usr/bin/env python3
"""
Face detection on traffic camera video using YuNet (MIT licence, OpenCV Zoo).
Produces a JSON region track for the blurring pipeline.

Usage: python3 detect_faces.py <video-path> [--output face-regions.json] [--every N]

Model: face_detection_yunet_2023mar.onnx (232 KB, MIT).
Falls back to Haar cascade if the YuNet model is not found.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import cv2


MODEL_PATH = Path(__file__).parent / "yunet.onnx"
HAAR_PATH = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"  # type: ignore


def pad_box(x, y, w, h, pad_factor, img_w, img_h):
    pw = int(w * pad_factor / 2)
    ph = int(h * pad_factor / 2)
    x1 = max(0, x - pw)
    y1 = max(0, y - ph)
    return x1, y1, min(img_w - x1, w + 2 * pw), min(img_h - y1, h + 2 * ph)


def main():
    parser = argparse.ArgumentParser(description="Detect faces in traffic camera video (YuNet)")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--output", "-o", default=None)
    parser.add_argument("--every", type=int, default=1, help="Process every Nth frame (default: 1 = all)")
    parser.add_argument("--pad", type=float, default=0.4, help="Padding factor (default: 0.4)")
    parser.add_argument("--conf", type=float, default=0.4, help="Confidence threshold (default: 0.4)")
    args = parser.parse_args()

    video_path = Path(args.video)
    if not video_path.exists():
        print(f"Error: {video_path} not found", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output) if args.output else Path(__file__).parent / "face-regions.json"

    # Open video first to get dimensions
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0

    # Init detector
    use_yunet = MODEL_PATH.exists()
    detector = None
    haar = None
    if use_yunet:
        print(f"Loading YuNet model from {MODEL_PATH}")
        detector = cv2.FaceDetectorYN.create(str(MODEL_PATH), "", (width, height), args.conf, 0.3, 5000)
        print("  YuNet ready")
    else:
        print(f"YuNet model not found at {MODEL_PATH}, falling back to Haar cascade")
        haar = cv2.CascadeClassifier(HAAR_PATH)

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

            if use_yunet and detector is not None:
                ok, faces = detector.detect(frame)
                if faces is not None:
                    for f in faces:
                        x, y, w, h = int(f[0]), int(f[1]), int(f[2]), int(f[3])
                        conf = float(f[-1])
                        if conf < args.conf:
                            continue
                        px, py, pw, ph = pad_box(x, y, w, h, args.pad, width, height)
                        all_detections.append({
                            "t": t_sec, "frame": frame_num, "label": "FACE",
                            "x": px, "y": py, "w": pw, "h": ph,
                            "confidence": round(conf, 3)
                        })
            else:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = haar.detectMultiScale(gray, 1.15, 5, minSize=(20, 20))
                for (x, y, w, h) in faces:
                    px, py, pw, ph = pad_box(x, y, w, h, args.pad, width, height)
                    all_detections.append({
                        "t": t_sec, "frame": frame_num, "label": "FACE",
                        "x": px, "y": py, "w": pw, "h": ph,
                        "confidence": 0.7
                    })

            elapsed = time.monotonic() - t0
            frame_times.append(elapsed)
            processed += 1

        frame_num += 1

    cap.release()

    # Build region track — one region per detection (simple, no cross-frame tracking yet)
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
        "detectors": ["yunet_2023mar" if use_yunet else "haar_cascade"],
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
    print(f"  Detector: {'YuNet' if use_yunet else 'Haar cascade'}")
    print(f"  Total face detections: {len(all_detections)}")
    print(f"  Frames processed: {processed}/{total_frames}")
    print(f"  Avg detection time: {avg_ms:.1f}ms per frame")
    print(f"  Output: {output_path}")


if __name__ == "__main__":
    main()
