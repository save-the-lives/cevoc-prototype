#!/usr/bin/env python3
"""
Frame-by-frame plate leak checker for the demo probe.
Downloads a blurred video, runs YOLO plate detection on every frame,
skips the offending plate region by IoU overlap, and fails if any
non-offending plate is found above the confidence threshold.

Generates a frame grid PNG (every 10th frame, 3 columns) with any
leaked plates highlighted in red.

Usage:
    python3 check_blur_leaks.py <video_url> [--output grid.png] [--model path/to/yolov8n-plates.onnx]

Exit codes:
    0 = no leaked plates found
    1 = leaked plates detected (frame numbers printed to stderr)
    2 = setup error (missing deps, bad URL, etc.)
"""
import argparse
import math
import os
import sys
import tempfile
import urllib.request

try:
    import cv2
    import numpy as np
except ImportError:
    print("ERROR: opencv-python-headless and numpy are required", file=sys.stderr)
    sys.exit(2)

INPUT_SIZE = 640
CONF_THRESHOLD = 0.10
NMS_THRESHOLD = 0.45
IOU_SKIP = 0.3  # skip detections overlapping the offending plate region


def iou_min(a, b):
    """IoU based on the smaller box area."""
    x1 = max(a[0], b[0])
    y1 = max(a[1], b[1])
    x2 = min(a[0] + a[2], b[0] + b[2])
    y2 = min(a[1] + a[3], b[1] + b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = a[2] * a[3]
    area_b = b[2] * b[3]
    denom = min(area_a, area_b)
    return inter / denom if denom > 0 else 0


def download_video(url, dest):
    """Download video from URL to local file."""
    print(f"Downloading video from {url[:80]}...")
    try:
        urllib.request.urlretrieve(url, dest)
    except Exception as e:
        print(f"ERROR: could not download video: {e}", file=sys.stderr)
        sys.exit(2)
    size_mb = os.path.getsize(dest) / 1048576
    print(f"Downloaded {size_mb:.1f} MB")


def find_model(model_path):
    """Locate the YOLO plate model."""
    candidates = [
        model_path,
        os.path.join(os.path.dirname(__file__), "..", "..", "backend", "blur-pipeline", "yolov8n-plates.onnx"),
        "yolov8n-plates.onnx",
    ]
    for p in candidates:
        if p and os.path.exists(p):
            return p
    print("ERROR: yolov8n-plates.onnx not found", file=sys.stderr)
    sys.exit(2)


def detect_plates_in_frame(net, frame, w, h):
    """Run YOLO plate detection on a single frame. Returns list of (x, y, w, h, conf)."""
    blob = cv2.dnn.blobFromImage(frame, 1 / 255.0, (INPUT_SIZE, INPUT_SIZE), swapRB=True, crop=False)
    net.setInput(blob)
    output = net.forward()
    data = output[0].T
    scale_x = w / INPUT_SIZE
    scale_y = h / INPUT_SIZE

    boxes, confs = [], []
    for row in data:
        cx, cy, bw, bh = row[:4]
        conf = float(row[4])
        if conf < CONF_THRESHOLD:
            continue
        x1 = int((cx - bw / 2) * scale_x)
        y1 = int((cy - bh / 2) * scale_y)
        pw = int(bw * scale_x)
        ph = int(bh * scale_y)
        # 20% padding
        ppx, ppy = int(pw * 0.2), int(ph * 0.2)
        x1 = max(0, x1 - ppx)
        y1 = max(0, y1 - ppy)
        pw = min(w - x1, pw + 2 * ppx)
        ph = min(h - y1, ph + 2 * ppy)
        boxes.append([x1, y1, pw, ph])
        confs.append(conf)

    results = []
    if boxes:
        indices = cv2.dnn.NMSBoxes(boxes, confs, CONF_THRESHOLD, NMS_THRESHOLD)
        if len(indices) > 0:
            for i in indices.flatten():
                results.append((*boxes[i], confs[i]))
    return results


def main():
    parser = argparse.ArgumentParser(description="Check blurred video for plate leaks")
    parser.add_argument("video_url", help="URL of the blurred video to check")
    parser.add_argument("--output", "-o", default="blur-leak-grid.png", help="Output frame grid PNG")
    parser.add_argument("--model", default=None, help="Path to yolov8n-plates.onnx")
    parser.add_argument("--offending-region", default=None,
                        help="x,y,w,h of the offending plate region to skip (approximate center)")
    args = parser.parse_args()

    model_path = find_model(args.model)
    print(f"Using model: {model_path}")
    net = cv2.dnn.readNetFromONNX(model_path)

    # Parse offending region if provided
    offending_box = None
    if args.offending_region:
        offending_box = list(map(int, args.offending_region.split(",")))

    # Download video
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        tmp_path = tmp.name
    try:
        download_video(args.video_url, tmp_path)
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            print("ERROR: could not open video", file=sys.stderr)
            sys.exit(2)

        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        print(f"Video: {w}x{h}, {total_frames} frames")

        leaked_frames = {}  # frame_num -> list of (x, y, w, h, conf)
        grid_frames = []  # (frame_num, frame_img, detections)
        frame_num = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            detections = detect_plates_in_frame(net, frame, w, h)

            # Filter out detections overlapping the offending plate region
            non_offending = []
            for det in detections:
                box = det[:4]
                if offending_box and iou_min(box, offending_box) > IOU_SKIP:
                    continue
                non_offending.append(det)

            if non_offending:
                leaked_frames[frame_num] = non_offending

            # Collect every 10th frame for the grid
            if frame_num % 10 == 0:
                grid_frames.append((frame_num, frame.copy(), non_offending))

            if frame_num % 20 == 0:
                leaked_here = len(non_offending)
                status = f"LEAKED {leaked_here}" if leaked_here else "clean"
                print(f"  frame {frame_num}/{total_frames}: {status}")

            frame_num += 1

        cap.release()

        # Generate frame grid
        if grid_frames:
            cols = 3
            rows = math.ceil(len(grid_frames) / cols)
            thumb_w, thumb_h = 360, int(360 * h / w)
            grid = np.full((rows * (thumb_h + 30), cols * (thumb_w + 4), 3), 255, dtype=np.uint8)

            for idx, (fn, img, dets) in enumerate(grid_frames):
                r, c_idx = divmod(idx, cols)
                thumb = cv2.resize(img, (thumb_w, thumb_h))

                # Draw leaked plates in red
                sx, sy = thumb_w / w, thumb_h / h
                for det in dets:
                    x1 = int(det[0] * sx)
                    y1 = int(det[1] * sy)
                    x2 = int((det[0] + det[2]) * sx)
                    y2 = int((det[1] + det[3]) * sy)
                    cv2.rectangle(thumb, (x1, y1), (x2, y2), (0, 0, 255), 2)
                    cv2.putText(thumb, f"{det[4]:.2f}", (x1, y1 - 4),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 255), 1)

                y_off = r * (thumb_h + 30)
                x_off = c_idx * (thumb_w + 4)
                grid[y_off:y_off + thumb_h, x_off:x_off + thumb_w] = thumb

                # Label
                label = f"Frame {fn}" + (" LEAKED" if dets else "")
                color = (0, 0, 200) if dets else (80, 80, 80)
                cv2.putText(grid, label, (x_off + 4, y_off + thumb_h + 20),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

            cv2.imwrite(args.output, grid)
            print(f"Frame grid saved to {args.output}")

        # Report
        total_leaked = sum(len(v) for v in leaked_frames.values())
        if total_leaked == 0:
            print(f"\nPASSED: no non-offending plates detected in {frame_num} frames")
            sys.exit(0)
        else:
            print(f"\nFAILED: {total_leaked} non-offending plate detections "
                  f"across {len(leaked_frames)} frames:", file=sys.stderr)
            for fn in sorted(leaked_frames.keys())[:20]:
                for det in leaked_frames[fn]:
                    print(f"  frame {fn}: box=({det[0]},{det[1]},{det[2]},{det[3]}) "
                          f"conf={det[4]:.3f}", file=sys.stderr)
            if len(leaked_frames) > 20:
                print(f"  ... and {len(leaked_frames) - 20} more frames", file=sys.stderr)
            sys.exit(1)

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


if __name__ == "__main__":
    main()
