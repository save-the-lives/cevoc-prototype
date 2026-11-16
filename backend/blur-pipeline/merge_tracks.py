#!/usr/bin/env python3
"""
Merge face and plate region tracks into one combined track for the blur renderer.
Carries the timestamps through; the renderer turns them into frame numbers with the video's own frame rate.
Also carries the offending plate, so the renderer and its verification know which plate stays visible.

Usage: python3 merge_tracks.py <faces.json> <plates.json> [--output merged.json]
"""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Merge face and plate region tracks")
    parser.add_argument("faces", help="Path to face regions JSON")
    parser.add_argument("plates", help="Path to plate regions JSON")
    parser.add_argument("--output", "-o", default=None)
    args = parser.parse_args()

    with open(args.faces) as f:
        faces = json.load(f)
    with open(args.plates) as f:
        plates = json.load(f)

    # No frame numbers are made here. Until 2026-11-17 this step guessed a frame rate (12) and truncated t * fps, so a
    # detection at t=0.0833 landed on frame 0 instead of 1: every third frame lost its offending-plate entry and the
    # verification then blurred the plate that should stay visible. The renderer reads the real rate from the video.
    merged = {"v": 1, "regions": [], "offending_plate": plates.get("offending_plate")}
    for source, default_label in ((faces, "FACE"), (plates, "PLATE")):
        for r in source.get("regions", []):
            for det in r.get("frames", []):
                det.setdefault("label", r.get("label", default_label))
            merged["regions"].append(r)

    output_path = Path(args.output) if args.output else Path(args.faces).parent / "merged-regions.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(merged, f, indent=2)
        f.write("\n")

    face_count = len(faces.get("regions", []))
    plate_count = len(plates.get("regions", []))
    offending = sum(1 for r in plates.get("regions", []) if r.get("label") == "PLATE_OFFENDING")
    print(f"Merged: {face_count} face + {plate_count} plate tracks ({offending} offending kept visible)")
    print(f"Output: {output_path}")


if __name__ == "__main__":
    main()
