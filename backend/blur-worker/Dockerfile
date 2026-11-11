# Blur worker container (ADR 0027).
# Standalone Python worker that pulls blur requests from a queue,
# runs the blur pipeline (face + plate detection + render), and
# pushes completion messages. Shares a volume with the Java backend
# for video file transfer.

FROM python:3.11-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg libgl1-mesa-glx libglib2.0-0 tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /tmp/
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# Non-root user
RUN useradd --system --no-create-home worker

WORKDIR /app

# Copy the blur pipeline scripts (same scripts as the monolith uses)
COPY ../blur-pipeline/ /app/blur-pipeline/
# Copy the worker code
COPY queue_adapter.py worker.py /app/

# Shared volume mount point
RUN mkdir -p /shared/blur-data && chown worker:worker /shared/blur-data
VOLUME /shared/blur-data

USER worker

ENV BLUR_SCRIPTS_DIR=/app/blur-pipeline \
    BLUR_SHARED_DIR=/shared/blur-data \
    BLUR_QUEUE_TYPE=redis \
    PYTHONUNBUFFERED=1

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD python3 /app/worker.py --health

ENTRYPOINT ["python3", "/app/worker.py"]
