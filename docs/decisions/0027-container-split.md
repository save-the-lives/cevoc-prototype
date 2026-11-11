# ADR 0027: Container Split — Python Blur Worker with Vendor-Neutral Queue

**Status:** Accepted  
**Date:** 2026-11-11

## Context

The CEVOC backend runs Java (Spring Boot) and Python (OpenCV, ffmpeg, YOLO models)
in a single container. The Python blur pipeline is CPU-intensive and adds ~800 MB of
image layers (OpenCV, NumPy, ffmpeg, Tesseract, ONNX models). This coupling means:

- A Java-only change rebuilds the full image including Python deps
- The blur pipeline cannot scale independently — a burst of blur requests blocks the
  Java thread pool even though blur runs in virtual threads
- Local development requires both Java 21 and Python 3 + OpenCV + ffmpeg installed
- Updating YOLO models requires a full backend redeploy

## Decision

Split the blur pipeline into a standalone **blur worker** container that communicates
with the Java backend via a **vendor-neutral message queue**.

### Architecture

```
┌──────────────────────┐        ┌──────────────┐        ┌──────────────────────┐
│   Java Backend       │        │    Queue      │        │   Blur Worker        │
│   (Spring Boot)      │──push──▶  (abstract)   │──pull──▶  (Python + OpenCV)  │
│                      │◀─poll──│              │        │                      │
│   QueueBlurAdapter   │        │  Redis /     │        │  worker.py           │
│   (implements        │        │  SQS /       │        │  detect_faces.py     │
│    BlurPort)         │        │  Azure Queue │        │  detect_plates.py    │
└──────────────────────┘        └──────────────┘        │  render_blur.py      │
                                                         └──────────────────────┘
```

### Queue Abstraction

The `queue_adapter.py` module provides a `BlurQueue` interface with three implementations:

| Adapter        | Backend config              | Use case               |
|----------------|-----------------------------|------------------------|
| `RedisQueue`   | `cevoc.blur.queue=redis`    | Local dev, self-hosted |
| `SqsQueue`     | `cevoc.blur.queue=sqs`      | AWS deployment         |
| `AzureQueue`   | `cevoc.blur.queue=azure`    | Azure deployment       |

### Message Format (JSON)

**Request** (backend → queue → worker):
```json
{
  "id": "uuid",
  "videoHash": "sha256-hex",
  "inputPath": "/shared/input-{hash}.mp4",
  "outputPath": "/shared/blurred-{hash}.mp4",
  "offendingPlate": "ABC123",
  "timestamp": "2026-11-11T12:00:00Z"
}
```

**Completion** (worker → queue → backend):
```json
{
  "id": "uuid",
  "videoHash": "sha256-hex",
  "status": "ok|failed",
  "outputPath": "/shared/blurred-{hash}.mp4",
  "detail": "...",
  "durationMs": 4500
}
```

### Shared Storage

Both containers mount a shared volume (`/shared/blur-data/`) for video files.
The queue carries metadata only — video bytes are never serialised into messages.

- **Local dev:** Docker volume shared between containers
- **AWS:** EFS mount on the Fargate tasks
- **Azure:** Azure Files share mounted on both App Service containers

### Backward Compatibility

`ProcessBlurAdapter` remains as the default (single-container mode). The adapter
is selected by configuration:

| Config value               | Adapter                | Mode              |
|----------------------------|------------------------|--------------------|
| `cevoc.blur.mode=process`  | `ProcessBlurAdapter`   | Single container   |
| `cevoc.blur.mode=queue`    | `QueueBlurAdapter`     | Split containers   |
| `cevoc.blur.mode=deny`     | `DenyAllBlurAdapter`   | Blur disabled      |

## Consequences

- **Positive:** Independent scaling, faster backend builds, cleaner separation of concerns
- **Positive:** YOLO model updates deploy without touching the Java backend
- **Positive:** Vendor-neutral — same worker image runs on AWS, Azure, or bare metal
- **Negative:** Shared filesystem adds operational complexity
- **Negative:** Adds a queue dependency (Redis for dev, managed queue for prod)
- **Mitigated:** Single-container fallback means no forced migration
