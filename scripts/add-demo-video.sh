#!/usr/bin/env bash
# Add a copyright-free video to the demo media set.
# Usage: ./scripts/add-demo-video.sh <video-file> <source-url> <licence> <licence-url>
#
# Example:
#   ./scripts/add-demo-video.sh ~/Downloads/traffic.mp4 \
#     "https://www.pexels.com/video/2053100/" \
#     "Pexels License (free, commercial OK, no attribution)" \
#     "https://www.pexels.com/license/"
#
# The script:
# 1. Copies the video to frontend/public/samples/video-1.mp4 (replacing the test pattern)
# 2. Updates docs/demo-media-manifest.json with source and licence
# 3. Reports the file size and duration (needs ffprobe)

set -euo pipefail

if [ $# -lt 4 ]; then
  echo "Usage: $0 <video-file> <source-url> <licence> <licence-url>"
  echo ""
  echo "Example:"
  echo "  $0 ~/Downloads/traffic.mp4 \\"
  echo "    'https://www.pexels.com/video/2053100/' \\"
  echo "    'Pexels License (free, commercial OK, no attribution)' \\"
  echo "    'https://www.pexels.com/license/'"
  exit 1
fi

VIDEO="$1"
SOURCE_URL="$2"
LICENCE="$3"
LICENCE_URL="$4"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$REPO_ROOT/frontend/public/samples/video-1.mp4"

if [ ! -f "$VIDEO" ]; then
  echo "Error: File not found: $VIDEO"
  exit 1
fi

# Check it's actually a video
MIME=$(file --mime-type -b "$VIDEO")
if [[ "$MIME" != video/* ]]; then
  echo "Error: $VIDEO is $MIME, not a video file"
  exit 1
fi

# Get duration and resolution if ffprobe is available
if command -v ffprobe &>/dev/null; then
  DURATION=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$VIDEO" 2>/dev/null | cut -d. -f1)
  RESOLUTION=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$VIDEO" 2>/dev/null)
  echo "Video: ${DURATION}s, ${RESOLUTION}"
else
  echo "ffprobe not found — skipping duration/resolution check"
fi

SIZE=$(stat -c%s "$VIDEO")
SIZE_MB=$(echo "scale=1; $SIZE / 1048576" | bc)

echo "File size: ${SIZE_MB} MB"

# Warn if very large (>20MB in a git repo)
if [ "$SIZE" -gt 20971520 ]; then
  echo "Warning: ${SIZE_MB} MB is large for a git repo. Consider compressing with:"
  echo "  ffmpeg -i '$VIDEO' -c:v libx264 -crf 28 -preset medium -c:a aac -b:a 128k -movflags +faststart output.mp4"
  read -p "Continue anyway? [y/N] " -r
  [[ $REPLY =~ ^[Yy]$ ]] || exit 0
fi

# Copy to target
cp "$VIDEO" "$TARGET"
echo "Copied to $TARGET"

# Update manifest
MANIFEST="$REPO_ROOT/docs/demo-media-manifest.json"
DATE=$(date -u +%Y-%m-%d)

if [ -f "$MANIFEST" ]; then
  # Update the existing video entry using python
  python3 -c "
import json, sys
with open('$MANIFEST') as f:
    m = json.load(f)
# Find and update video entry, or add one
found = False
for item in m.get('media', []):
    if item.get('kind') == 'video' or 'video' in item.get('file', ''):
        item['source'] = '$SOURCE_URL'
        item['licence'] = '$LICENCE'
        item['licenceUrl'] = '$LICENCE_URL'
        item['retrieved'] = '$DATE'
        item['privacyCheck'] = 'Contains real vehicles and people — baseline for blurring pipeline testing'
        found = True
        break
if not found:
    m.setdefault('media', []).append({
        'file': 'media/sample-video-1.mp4',
        'kind': 'video',
        'description': 'Traffic footage with vehicles and pedestrians — copyright-free baseline for blurring pipeline',
        'source': '$SOURCE_URL',
        'author': 'See source',
        'licence': '$LICENCE',
        'licenceUrl': '$LICENCE_URL',
        'retrieved': '$DATE',
        'privacyCheck': 'Contains real vehicles and people — baseline for blurring pipeline testing'
    })
with open('$MANIFEST', 'w') as f:
    json.dump(m, f, indent=2)
    f.write('\n')
print('Manifest updated')
"
else
  echo "Warning: $MANIFEST not found — create it manually"
fi

echo ""
echo "Done. Next steps:"
echo "  1. git add frontend/public/samples/video-1.mp4 docs/demo-media-manifest.json"
echo "  2. git commit -m 'feat: add copyright-free traffic video to demo cases'"
echo "  3. git push origin main"
echo ""
echo "The video will appear in demo case 0001 (Everything returned) and any other case with video enabled."
