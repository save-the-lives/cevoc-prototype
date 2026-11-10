#!/usr/bin/env python3
"""
Merge face and plate region tracks into one combined track for the blur renderer.
Adds frame numbers from timestamps if missing.

Usage: python3 merge_tracks.py <faces.json> <plates.json> [--output merged.json] [--fps 12]
"""
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description="Merge face and plate region tracks")
    parser.add_argument("faces", help="Path to face regions JSON")
    parser.add_argument("plates", help="Path to plate regions JSON")
    parser.add_argument("--output", "-o", default=None)
    parser.add_argument("--fps", type=float, default=12, help="Video FPS for frame number calculation")
    args = parser.parse_args()

    with open(args.faces) as f:
        faces = json.load(f)
    with open(args.plates) as f:
        plates = json.load(f)

    fps = faces.get("fps", args.fps)
    merged = {"v": 1, "regions": []}

    # Merge face regions, ensure frame numbers exist
    for r in faces.get("regions", []):
        for det in r.get("frames", []):
            det.setdefault("label", r.get("label", "FACE"))
            if "frame" not in det and "t" in det:
                det["frame"] = int(det["t"] * fps)
        merged["regions"].append(r)

    # Merge plate regions, ensure frame numbers exist
    for r in plates.get("regions", []):
        for det in r.get("frames", []):
            det.setdefault("label", r.get("label", "PLATE"))
            if "frame" not in det and "t" in det:
                det["frame"] = int(det["t"] * fps)
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
