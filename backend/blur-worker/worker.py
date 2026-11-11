#!/usr/bin/env python3
"""
Blur worker — standalone process that pulls blur requests from a queue,
runs the blur pipeline, and pushes completion messages (ADR 0027).

Runs in its own container alongside the Java backend. Both mount a shared
volume for video files (the queue carries metadata, not video bytes).

Usage:
    python3 worker.py                         # run as worker (default)
    python3 worker.py --push '{"id":...}'     # push a request (used by Java adapter CLI)
    python3 worker.py --health                # check queue health

Environment:
    BLUR_QUEUE_TYPE     redis | sqs | azure  (default: redis)
    BLUR_SCRIPTS_DIR    path to blur pipeline scripts (default: /app/blur-pipeline)
    BLUR_SHARED_DIR     shared volume for video files (default: /shared/blur-data)
    BLUR_MAX_RETRIES    max retries per request (default: 1)
    REDIS_URL           Redis connection URL (for redis queue type)
"""
import argparse
import json
import logging
import os
import signal
import subprocess
import sys
import time
import uuid
from pathlib import Path

from queue_adapter import create_queue

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("blur-worker")

SCRIPTS_DIR = Path(os.environ.get("BLUR_SCRIPTS_DIR", "/app/blur-pipeline"))
SHARED_DIR = Path(os.environ.get("BLUR_SHARED_DIR", "/shared/blur-data"))
MAX_RETRIES = int(os.environ.get("BLUR_MAX_RETRIES", "1"))
TIMEOUT_S = 120

_shutdown = False


def handle_signal(signum, frame):
    global _shutdown
    log.info("Received signal %s, shutting down gracefully...", signum)
    _shutdown = True


signal.signal(signal.SIGTERM, handle_signal)
signal.signal(signal.SIGINT, handle_signal)


def run_script(name: str, *args) -> bool:
    """Run a blur pipeline script. Returns True on success."""
    script = SCRIPTS_DIR / name
    if not script.exists():
        log.error("Script not found: %s", script)
        return False
    cmd = ["python3", "-I", str(script)] + list(args)
    log.info("Running: %s", " ".join(cmd[-3:]))
    try:
        proc = subprocess.run(
            cmd,
            timeout=TIMEOUT_S,
            capture_output=False,  # let output stream to our stdout
            env={**os.environ, "PYTHONUNBUFFERED": "1", "PYTHONDONTWRITEBYTECODE": "1"},
        )
        if proc.returncode != 0:
            log.warning("Script %s exited with code %d", name, proc.returncode)
            return False
        return True
    except subprocess.TimeoutExpired:
        log.error("Script %s timed out after %ds", name, TIMEOUT_S)
        return False
    except Exception as e:
        log.error("Failed to run %s: %s", name, e)
        return False


def process_request(req: dict) -> dict:
    """
    Run the full blur pipeline on one request.
    Returns a completion message.
    """
    req_id = req.get("id", str(uuid.uuid4()))
    video_hash = req["videoHash"]
    input_path = Path(req["inputPath"])
    output_path = Path(req["outputPath"])
    offending_plate = req.get("offendingPlate")

    t0 = time.time()
    log.info("Processing blur request %s (hash %s)", req_id, video_hash[:12])

    if not input_path.exists():
        return {
            "id": req_id,
            "videoHash": video_hash,
            "status": "failed",
            "detail": f"Input file not found: {input_path}",
            "durationMs": 0,
        }

    # Create a work directory next to the output
    work_dir = output_path.parent / f".work-{video_hash[:12]}"
    work_dir.mkdir(parents=True, exist_ok=True)

    face_regions = work_dir / "face-regions.json"
    plate_regions = work_dir / "plate-regions.json"
    merged_regions = work_dir / "merged-regions.json"

    steps = [
        ("detect_faces.py", [str(input_path), "--output", str(face_regions)]),
    ]
    if offending_plate:
        steps.append((
            "detect_plates.py",
            [str(input_path), "--offending", offending_plate, "--output", str(plate_regions)],
        ))
    else:
        steps.append((
            "detect_plates.py",
            [str(input_path), "--output", str(plate_regions)],
        ))
    steps.append((
        "merge_tracks.py",
        [str(face_regions), str(plate_regions), "--output", str(merged_regions)],
    ))
    steps.append((
        "render_blur.py",
        [str(input_path), str(merged_regions), "--output", str(output_path)],
    ))

    for script_name, script_args in steps:
        if not run_script(script_name, *script_args):
            _cleanup(work_dir)
            elapsed_ms = int((time.time() - t0) * 1000)
            return {
                "id": req_id,
                "videoHash": video_hash,
                "status": "failed",
                "detail": f"{script_name} failed",
                "durationMs": elapsed_ms,
            }

    _cleanup(work_dir)
    elapsed_ms = int((time.time() - t0) * 1000)

    if not output_path.exists() or output_path.stat().st_size == 0:
        return {
            "id": req_id,
            "videoHash": video_hash,
            "status": "failed",
            "detail": "Output file is empty or missing",
            "durationMs": elapsed_ms,
        }

    log.info(
        "Blur complete: %s -> %s (%d bytes, %dms)",
        input_path.name, output_path.name,
        output_path.stat().st_size, elapsed_ms,
    )

    return {
        "id": req_id,
        "videoHash": video_hash,
        "status": "ok",
        "outputPath": str(output_path),
        "durationMs": elapsed_ms,
    }


def _cleanup(work_dir: Path):
    """Remove the temporary work directory."""
    import shutil
    try:
        shutil.rmtree(work_dir)
    except Exception:
        pass


def run_worker():
    """Main worker loop: pull requests, process, push completions."""
    SHARED_DIR.mkdir(parents=True, exist_ok=True)
    queue = create_queue()
    log.info(
        "Blur worker started (queue=%s, scripts=%s, shared=%s)",
        os.environ.get("BLUR_QUEUE_TYPE", "redis"),
        SCRIPTS_DIR, SHARED_DIR,
    )

    while not _shutdown:
        try:
            req = queue.pull_request(timeout_s=5)
            if req is None:
                continue

            receipt = req.pop("_receipt", None)
            completion = process_request(req)
            queue.push_completion(completion)

            if receipt is not None:
                queue.ack_request(receipt)

        except Exception as e:
            log.error("Worker loop error: %s", e, exc_info=True)
            time.sleep(2)

    log.info("Blur worker shut down cleanly")


def main():
    parser = argparse.ArgumentParser(description="CEVOC blur worker")
    parser.add_argument("--push", help="Push a JSON request to the queue (used by Java adapter)")
    parser.add_argument("--health", action="store_true", help="Check queue health")
    args = parser.parse_args()

    if args.health:
        queue = create_queue()
        ok = queue.healthy()
        print("healthy" if ok else "unhealthy")
        sys.exit(0 if ok else 1)

    if args.push:
        queue = create_queue()
        queue.push_request(json.loads(args.push))
        print("pushed")
        sys.exit(0)

    run_worker()


if __name__ == "__main__":
    main()
