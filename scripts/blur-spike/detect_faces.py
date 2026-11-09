#!/usr/bin/env python3
"""
Face detection on traffic camera video using MediaPipe BlazeFace.
Produces a JSON region track for the blurring pipeline.

Usage: python3 detect_faces.py <video-path> [--output face-regions.json] [--every N]

MediaPipe BlazeFace is MIT-licensed and bundles its own model.
A Haar cascade secondary detector is used as a union vote for recall.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import mediapipe as mp


def detect_faces_mediapipe(frame_rgb, mp_detector):
    """Run MediaPipe face detection, return list of (x, y, w, h, confidence)."""
    result = mp_detector.process(frame_rgb)
    faces = []
    if result.detections:
        h, w = frame_rgb.shape[:2]
        for det in result.detections:
            bb = det.location_data.relative_bounding_box
            x = int(bb.xmin * w)
            y = int(bb.ymin * h)
            bw = int(bb.width * w)
            bh = int(bb.height * h)
            conf = det.score[0] if det.score else 0.5
            faces.append((x, y, bw, bh, float(conf)))
    return faces


def detect_faces_haar(frame_gray, cascade):
    """Run Haar cascade face detection as a secondary detector."""
    rects = cascade.detectMultiScale(frame_gray, scaleFactor=1.1, minNeighbors=4, minSize=(30, 30))
    return [(x, y, w, h, 0.3) for (x, y, w, h) in rects]


def pad_box(x, y, w, h, pad_factor, img_w, img_h):
    """Pad a detection box by pad_factor (e.g. 0.3 = 30%)."""
    pw = int(w * pad_factor / 2)
    ph = int(h * pad_factor / 2)
    x2 = max(0, x - pw)
    y2 = max(0, y - ph)
    w2 = min(img_w - x2, w + 2 * pw)
    h2 = min(img_h - y2, h + 2 * ph)
    return x2, y2, w2, h2


def iou(a, b):
    """Intersection over union of two (x, y, w, h) boxes."""
    ax1, ay1, ax2, ay2 = a[0], a[1], a[0] + a[2], a[1] + a[3]
    bx1, by1, bx2, by2 = b[0], b[1], b[0] + b[2], b[1] + b[3]
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    union = a[2] * a[3] + b[2] * b[3] - inter
    return inter / union if union > 0 else 0


def merge_detections(mp_faces, haar_faces, iou_thresh=0.3):
    """Union of both detectors. Deduplicate overlapping boxes."""
    all_faces = list(mp_faces)
    for hf in haar_faces:
        # Add Haar detection only if it doesn't overlap an existing MP detection
        if not any(iou(hf[:4], mf[:4]) > iou_thresh for mf in all_faces):
            all_faces.append(hf)
    return all_faces


def main():
    parser = argparse.ArgumentParser(description="Detect faces in traffic camera video")
    parser.add_argument("video", help="Path to video file")
    parser.add_argument("--output", "-o", default=None, help="Output JSON path (default: same dir as script)")
    parser.add_argument("--every", type=int, default=2, help="Process every Nth frame (default: 2)")
    parser.add_argument("--pad", type=float, default=0.3, help="Padding factor (default: 0.3 = 30%%)")
    parser.add_argument("--conf", type=float, default=0.3, help="MediaPipe confidence threshold (default: 0.3)")
    args = parser.parse_args()

    video_path = Path(args.video)
    if not video_path.exists():
        print(f"Error: {video_path} not found", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.output) if args.output else Path(__file__).parent / "face-regions.json"

    # Open video
    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = total_frames / fps if fps > 0 else 0

    print(f"Video: {video_path.name}")
    print(f"  {width}x{height}, {fps:.1f} fps, {total_frames} frames, {duration:.1f}s")
    print(f"  Processing every {args.every} frame(s), confidence >= {args.conf}")
    print()

    # Init detectors
    mp_face = mp.solutions.face_detection.FaceDetection(
        model_selection=1,  # full range model (better for distant faces)
        min_detection_confidence=args.conf
    )

    # Try Haar cascade (may not be available without XML files)
    haar = None
    haar_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    if Path(haar_path).exists():
        haar = cv2.CascadeClassifier(haar_path)
        print("  Haar cascade: loaded (secondary detector)")
    else:
        print("  Haar cascade: not available (MediaPipe only)")

    # Process frames
    regions = []  # list of per-detection region tracks
    frame_detections = []  # flat list for grouping later
    frame_num = 0
    processed = 0
    total_faces = 0
    frame_times = []

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        if frame_num % args.every == 0:
            t0 = time.monotonic()
            t_sec = frame_num / fps if fps > 0 else 0

            # MediaPipe expects RGB
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_faces = detect_faces_mediapipe(rgb, mp_face)

            # Haar on grayscale
            haar_faces = []
            if haar is not None:
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                haar_faces = detect_faces_haar(gray, haar)

            # Merge (union)
            merged = merge_detections(mp_faces, haar_faces)

            # Pad and record
            for (x, y, w, h, conf) in merged:
                px, py, pw, ph = pad_box(x, y, w, h, args.pad, width, height)
                frame_detections.append({
                    "t": round(t_sec, 3),
                    "frame": frame_num,
                    "x": px, "y": py, "w": pw, "h": ph,
                    "confidence": round(conf, 3),
                    "source": "mediapipe" if conf > 0.3 else "haar"
                })
                total_faces += 1

            elapsed = time.monotonic() - t0
            frame_times.append(elapsed)
            processed += 1

            if processed % 10 == 0:
                print(f"  Frame {frame_num}/{total_frames}: {len(merged)} faces ({elapsed*1000:.0f}ms)")

        frame_num += 1

    cap.release()
    mp_face.close()

    # Build region track (group detections into continuous tracks by proximity)
    # Simple approach: each detection is its own region entry with one frame
    # A proper tracker (ByteTrack etc) would merge across frames
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
        "detectors": ["mediapipe_blazeface_full"] + (["haar_frontalface"] if haar else []),
        "regions": [
            {
                "id": i,
                "label": "FACE",
                "frames": [det]
            }
            for i, det in enumerate(frame_detections)
        ]
    }

    # Write output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(track, f, indent=2)
        f.write("\n")

    # Summary
    avg_ms = sum(frame_times) * 1000 / len(frame_times) if frame_times else 0
    print()
    print(f"Results:")
    print(f"  Total detections: {total_faces}")
    print(f"  Frames processed: {processed}/{total_frames}")
    print(f"  Avg detection time: {avg_ms:.1f}ms per frame")
    print(f"  Output: {output_path}")
    print()

    # Print per-frame breakdown
    by_time = {}
    for det in frame_detections:
        by_time.setdefault(det["t"], []).append(det)
    print(f"  Detections by timestamp:")
    for t in sorted(by_time.keys()):
        dets = by_time[t]
        print(f"    t={t:.3f}s: {len(dets)} face(s) — " +
              ", ".join(f"({d['x']},{d['y']}) {d['w']}x{d['h']} conf={d['confidence']}" for d in dets))


if __name__ == "__main__":
    main()
