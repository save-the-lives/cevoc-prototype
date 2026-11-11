#!/usr/bin/env python3
"""
Frame-by-frame plate leak check for blurred demo videos.
Downloads a video URL, runs YOLO plate detection on every frame,
and fails if any non-offending plate is detected above threshold.

Also generates a frame grid (composite image) of sampled frames
with any leaked plate detections highlighted in red.

Usage:
  python3 check_blur_leaks.py <video_url> \
      --model <yolov8n-plates.onnx> \
      --offending-box <x,y,w,h>  \
      [--threshold 0.10] \
      [--output-grid frame-grid.png]

Exit codes:
  0 = clean (no leaked plates)
  1 = leaked plates found
  2 = video could not be fetched or decoded
"""
import argparse
import sys
import urllib.request
import tempfile
from pathlib import Path

import cv2
import numpy as np


def detect_plates(frame, net, input_size=640, threshold=0.10):
    """Run YOLO plate detection on a single frame. Returns list of (x,y,w,h,conf)."""
    h_img, w_img = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (input_size, input_size),
                                 swapRB=True, crop=False)
    net.setInput(blob)
    output = net.forward()
    data = output[0].T
    scale_x = w_img / input_size
    scale_y = h_img / input_size

    boxes, confs = [], []
    for row in data:
        cx, cy, bw, bh = row[:4]
        conf = float(row[4])
        if conf < threshold:
            continue
        x1 = int((cx - bw / 2) * scale_x)
        y1 = int((cy - bh / 2) * scale_y)
        pw = int(bw * scale_x)
        ph = int(bh * scale_y)
        boxes.append([x1, y1, pw, ph])
        confs.append(conf)

    results = []
    if boxes:
        indices = cv2.dnn.NMSBoxes(boxes, confs, threshold, 0.45)
        if len(indices) > 0:
            for i in indices.flatten():
                results.append((*boxes[i], confs[i]))
    return results


def iou_min(a, b):
    """IoU over smaller box area."""
    x1 = max(a[0], b[0])
    y1 = max(a[1], b[1])
    x2 = min(a[0] + a[2], b[0] + b[2])
    y2 = min(a[1] + a[3], b[1] + b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = a[2] * a[3]
    area_b = b[2] * b[3]
    denom = min(area_a, area_b)
    if denom == 0:
        return 0
    return inter / denom


def main():
    parser = argparse.ArgumentParser(description="Check blurred video for plate leaks")
    parser.add_argument("video_url", help="URL of blurred video to check")
    parser.add_argument("--model", required=True, help="Path to yolov8n-plates.onnx")
    parser.add_argument("--offending-box", default=None,
                        help="x,y,w,h of offending plate region to skip (approximate)")
    parser.add_argument("--threshold", type=float, default=0.10,
                        help="Confidence threshold (default 0.10)")
    parser.add_argument("--output-grid", default="frame-grid.png",
                        help="Output path for frame grid image")
    args = parser.parse_args()

    # Parse offending box
    offending = None
    if args.offending_box:
        parts = [int(x) for x in args.offending_box.split(",")]
        if len(parts) == 4:
            offending = tuple(parts)

    # Download video
    print(f"Downloading video from {args.video_url[:80]}...", flush=True)
    try:
        tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
        urllib.request.urlretrieve(args.video_url, tmp.name)
        video_path = tmp.name
    except Exception as e:
        print(f"ERROR: Could not fetch video: {e}", flush=True)
        sys.exit(2)

    # Load model
    print(f"Loading plate model from {args.model}...", flush=True)
    net = cv2.dnn.readNetFromONNX(args.model)

    # Process every frame
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print("ERROR: Could not open video file", flush=True)
        sys.exit(2)

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Video: {total_frames} frames, "
          f"{int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}", flush=True)

    leaked_detections = []  # (frame_num, x, y, w, h, conf)
    grid_frames = []  # (frame_num, frame_img, detections_on_this_frame)
    frame_num = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        plates = detect_plates(frame, net, threshold=args.threshold)

        # Filter out offending plate region
        non_offending = []
        for (x, y, w, h, conf) in plates:
            if offending and iou_min((x, y, w, h), offending) > 0.3:
                continue  # skip offending plate
            non_offending.append((x, y, w, h, conf))

        if non_offending:
            for det in non_offending:
                leaked_detections.append((frame_num, *det))
                print(f"  LEAK frame {frame_num}: plate at ({det[0]},{det[1]} {det[2]}x{det[3]}) conf={det[4]:.3f}", flush=True)

        # Sample every 10th frame for the grid
        if frame_num % 10 == 0:
            grid_frames.append((frame_num, frame.copy(), non_offending))

        if frame_num % 50 == 0:
            print(f"  Checked frame {frame_num}/{total_frames}...", flush=True)
        frame_num += 1

    cap.release()

    # Generate frame grid
    if grid_frames:
        print(f"Generating frame grid ({len(grid_frames)} sampled frames)...", flush=True)
        cols = 3
        rows = (len(grid_frames) + cols - 1) // cols
        # Resize each frame to a thumbnail
        thumb_w, thumb_h = 320, 180
        grid = np.zeros((rows * (thumb_h + 30), cols * (thumb_w + 4), 3), dtype=np.uint8)

        for idx, (fn, img, dets) in enumerate(grid_frames):
            r, c_col = divmod(idx, cols)
            thumb = cv2.resize(img, (thumb_w, thumb_h))

            # Draw leaked plate boxes in red
            h_img, w_img = img.shape[:2]
            sx, sy = thumb_w / w_img, thumb_h / h_img
            for (x, y, w, h, conf) in dets:
                tx, ty = int(x * sx), int(y * sy)
                tw, th = int(w * sx), int(h * sy)
                cv2.rectangle(thumb, (tx, ty), (tx + tw, ty + th), (0, 0, 255), 2)
                cv2.putText(thumb, f"{conf:.2f}", (tx, ty - 4),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

            # Label
            label = f"F{fn}"
            if dets:
                label += f" LEAK({len(dets)})"
            color = (0, 0, 255) if dets else (200, 200, 200)

            y_off = r * (thumb_h + 30)
            x_off = c_col * (thumb_w + 4)
            grid[y_off:y_off + thumb_h, x_off:x_off + thumb_w] = thumb
            cv2.putText(grid, label, (x_off + 4, y_off + thumb_h + 20),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

        cv2.imwrite(args.output_grid, grid)
        print(f"Frame grid saved to {args.output_grid}", flush=True)

    # Summary
    print(f"\n{'='*60}", flush=True)
    print(f"RESULT: {len(leaked_detections)} leaked plate detections across {frame_num} frames", flush=True)
    if leaked_detections:
        print("FAILED: Non-offending plates visible in blurred output!", flush=True)
        for (fn, x, y, w, h, conf) in leaked_detections[:20]:
            print(f"  Frame {fn}: ({x},{y} {w}x{h}) conf={conf:.3f}", flush=True)
        if len(leaked_detections) > 20:
            print(f"  ... and {len(leaked_detections) - 20} more", flush=True)
        sys.exit(1)
    else:
        print("PASSED: No leaked plates detected in blurred video", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()
