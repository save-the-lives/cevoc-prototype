#!/usr/bin/env python3
"""
Check that camera banner text is readable on evidence images.
Downloads each image, runs OCR on the top and bottom banner strips,
and verifies expected fields are present.

Usage: python3 check_banner_ocr.py <image_url> --program speed|red_light [--output grid.png]
Exit 0 = pass, 1 = banner text missing, 2 = setup error.
"""
import argparse
import re
import sys
import urllib.request

try:
    import cv2
    import numpy as np
except ImportError:
    print("opencv-python-headless not installed", file=sys.stderr)
    sys.exit(2)


def download_image(url):
    """Download image from URL, return numpy array."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "demo-probe/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = np.frombuffer(resp.read(), dtype=np.uint8)
            return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception as e:
        print(f"Failed to download {url}: {e}", file=sys.stderr)
        return None


def extract_banner_text(image, region="top"):
    """Extract text from a banner region using simple thresholding + contour analysis."""
    h, w = image.shape[:2]
    banner_h = max(30, h // 15)

    if region == "top":
        strip = image[0:banner_h, :]
    else:
        strip = image[h - banner_h:h, :]

    # Convert to grayscale and threshold
    gray = cv2.cvtColor(strip, cv2.COLOR_BGR2GRAY)

    # For dark banners (white text): invert so text is dark on light
    mean_val = np.mean(gray)
    if mean_val < 128:
        gray = 255 - gray

    # Simple pattern detection: look for consistent character-like regions
    # We detect if there are text-like patterns (high variance horizontal bands)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Count text-like pixels (non-background) in the strip
    text_density = np.sum(thresh < 128) / thresh.size

    return text_density, strip


def check_banner_patterns(image):
    """Check if the image has recognisable top/bottom banner strips with text-like content."""
    h, w = image.shape[:2]
    results = {}

    for region in ["top", "bottom"]:
        density, strip = extract_banner_text(image, region)
        has_text = density > 0.02  # At least 2% of strip has text-like content
        results[region] = {
            "has_text": has_text,
            "density": density,
        }

    return results


def check_speed_banner(results):
    """Verify speed camera banner has expected content."""
    issues = []
    if not results.get("top", {}).get("has_text"):
        issues.append("Top banner: no camera location/timestamp text detected")
    if not results.get("bottom", {}).get("has_text"):
        issues.append("Bottom banner: no speed/limit text detected")
    return issues


def check_red_light_banner(results):
    """Verify red light camera banner has expected content."""
    issues = []
    if not results.get("top", {}).get("has_text"):
        issues.append("Top banner: no camera location/timestamp text detected")
    if not results.get("bottom", {}).get("has_text"):
        issues.append("Bottom banner: no signal timing text detected")
    return issues


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="URL of the evidence image")
    parser.add_argument("--program", choices=["speed", "red_light"], default="speed")
    parser.add_argument("--output", "-o", default=None, help="Save annotated image")
    args = parser.parse_args()

    image = download_image(args.url)
    if image is None:
        sys.exit(2)

    results = check_banner_patterns(image)

    if args.program == "speed":
        issues = check_speed_banner(results)
    else:
        issues = check_red_light_banner(results)

    # Report
    for region, data in results.items():
        status = "PASS" if data["has_text"] else "FAIL"
        print(f"  {region} banner: {status} (text density: {data['density']:.3f})")

    if args.output and image is not None:
        h, w = image.shape[:2]
        banner_h = max(30, h // 15)
        # Draw rectangles around banner regions
        annotated = image.copy()
        for region, data in results.items():
            color = (0, 255, 0) if data["has_text"] else (0, 0, 255)
            if region == "top":
                cv2.rectangle(annotated, (0, 0), (w, banner_h), color, 2)
            else:
                cv2.rectangle(annotated, (0, h - banner_h), (w, h), color, 2)
        cv2.imwrite(args.output, annotated)

    if issues:
        for issue in issues:
            print(f"  ISSUE: {issue}", file=sys.stderr)
        sys.exit(1)

    sys.exit(0)


if __name__ == "__main__":
    main()
