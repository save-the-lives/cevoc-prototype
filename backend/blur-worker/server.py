#!/usr/bin/env python3
"""
Blur worker over HTTP (record 0036). Runs the same blur pipeline as the app, in its own container, so blurring a video
does not take CPU from the app's Chromium lookups.

  POST /blur     body: the video (video/mp4). Header X-Keep-Plate: the notice's own plate (optional).
                 200 video/mp4: the blurred video. 422 text/plain: blurring failed (the app treats it as failed and
                 never shows the raw video). 413: too large.
  GET  /health   200 "ok".

One blur at a time: the pipeline uses every core, so a second request waits for the first.
The plate is used for this request only: not logged, not stored. Temporary files are deleted after each request.
"""
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

SCRIPTS = Path(os.environ.get("BLUR_SCRIPTS_DIR", "/app/blur-pipeline"))
PORT = int(os.environ.get("PORT", "8080"))
MAX_BYTES = int(os.environ.get("BLUR_MAX_BYTES", str(200 * 1024 * 1024)))
STEP_TIMEOUT = int(os.environ.get("BLUR_STEP_TIMEOUT_SECONDS", "300"))
ONE_AT_A_TIME = threading.Lock()


def run(*args):
    """Runs one pipeline script. Returns None on success, else a short reason (never the plate)."""
    try:
        r = subprocess.run([sys.executable, str(SCRIPTS / args[0]), *map(str, args[1:])],
                           stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=STEP_TIMEOUT)
    except subprocess.TimeoutExpired:
        return f"{args[0]} timed out"
    if r.returncode != 0:
        return f"{args[0]} failed ({r.returncode})"
    return None


def blur(video: bytes, plate):
    work = Path(tempfile.mkdtemp(prefix="blur-"))
    try:
        src, faces, plates, merged, out = (work / n for n in
                                           ("input.mp4", "faces.json", "plates.json", "merged.json", "blurred.mp4"))
        src.write_bytes(video)
        plate_args = ["--offending", plate] if plate else []
        for step in (("detect_faces.py", src, "--output", faces),
                     ("detect_plates.py", src, *plate_args, "--output", plates),
                     ("merge_tracks.py", faces, plates, "--output", merged),
                     ("render_blur.py", src, merged, "--output", out)):
            why = run(*step)
            if why:
                return None, why
        if not out.exists() or out.stat().st_size == 0:
            return None, "blur output is empty"
        return out.read_bytes(), None
    finally:
        shutil.rmtree(work, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):  # request lines only; headers (the plate) are never logged
        sys.stderr.write("[blur-worker] %s\n" % (fmt % args))

    def reply(self, code, body: bytes, ctype="text/plain; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self.reply(200, b"ok")
        else:
            self.reply(404, b"not found")

    def do_POST(self):
        if self.path != "/blur":
            self.reply(404, b"not found")
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            self.reply(400, b"no video")
            return
        if length > MAX_BYTES:
            self.reply(413, b"video too large")
            return
        video = self.rfile.read(length)
        plate = (self.headers.get("X-Keep-Plate") or "").strip() or None
        with ONE_AT_A_TIME:
            data, why = blur(video, plate)
        if data is None:
            sys.stderr.write(f"[blur-worker] blur failed: {why}\n")
            self.reply(422, why.encode())
        else:
            self.reply(200, data, "video/mp4")


if __name__ == "__main__":
    print(f"[blur-worker] listening on {PORT}", flush=True)
    ThreadingHTTPServer(("", PORT), Handler).serve_forever()
