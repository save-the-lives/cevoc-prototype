#!/usr/bin/env python3
"""
Runs the whole blur pipeline on a video and checks, frame by frame, that the plate given as --offending is still
sharp in the output (and has a known position in every frame where it was seen). Exits 1 if any frame blurred it.
Added 2026-11-17 after the own plate was blurred in every third frame of the demo video (decision record 0034).

Usage: python3 check_own_plate.py <video> --offending <PLATE> [--workdir DIR]
"""
import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

import cv2

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
import render_blur as rb  # noqa: E402


def run(*args):
    subprocess.run([sys.executable, *map(str, args)], check=True)


def sharpness(img):
    return cv2.Laplacian(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), cv2.CV_64F).var()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("video")
    p.add_argument("--offending", required=True)
    p.add_argument("--workdir")
    a = p.parse_args()
    work = Path(a.workdir or tempfile.mkdtemp())
    work.mkdir(parents=True, exist_ok=True)
    video = Path(a.video)

    run(HERE / "detect_faces.py", video, "--output", work / "faces.json")
    run(HERE / "detect_plates.py", video, "--offending", a.offending, "--output", work / "plates.json")
    run(HERE / "merge_tracks.py", work / "faces.json", work / "plates.json", "--output", work / "merged.json")
    run(HERE / "render_blur.py", video, work / "merged.json", "--output", work / "out.mp4")

    src = cv2.VideoCapture(str(video))
    fps, total = src.get(cv2.CAP_PROP_FPS), int(src.get(cv2.CAP_PROP_FRAME_COUNT))
    _, by_frame = rb.load_regions(work / "merged.json", fps)
    by_frame = rb.interpolate_regions(by_frame, total)
    out = cv2.VideoCapture(str(work / "out.mp4"))
    seen, blurred = 0, []
    for i in range(total):
        ok_a, fa = src.read()
        ok_b, fb = out.read()
        if not (ok_a and ok_b):
            break
        for o in (d for d in by_frame.get(i, []) if d.get("label") == "PLATE_OFFENDING"):
            x, y = max(0, int(o["x"])), max(0, int(o["y"]))
            x1, y1 = int(o["x"] + o["w"]), int(o["y"] + o["h"])
            before, after = sharpness(fa[y:y1, x:x1]), sharpness(fb[y:y1, x:x1])
            seen += 1
            if after < 0.5 * before:
                blurred.append(i)
    print(f"[check_own_plate] own plate positions checked: {seen}; frames where it was blurred: {blurred}")
    if seen == 0:
        print("::error::The own plate was not found in the video, so nothing was checked")
        sys.exit(1)
    if blurred:
        print("::error::The own plate was blurred in some frames")
        sys.exit(1)


if __name__ == "__main__":
    main()
