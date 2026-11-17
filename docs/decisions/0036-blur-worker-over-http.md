# 0036. Blur runs in its own container, called over HTTP

Date: 2026-11-17. Status: accepted (owner approved the split by voice, 2026-11-17).

## Why
Blurring a video uses every core for about a minute. In the one app container that competed with Chromium: on
2026-11-17 a live lookup missed its photos while the demo video was being blurred. The environment's quota is 100
consumption cores with 2 in use, so a second container fits.

## Decision
- `backend/blur-worker/server.py` (image `backend/blur-worker/Dockerfile.http`) runs the same blur pipeline scripts as
  the app. `POST /blur` with the video, the notice's own plate in `X-Keep-Plate`; answers the blurred video (200) or a
  failure (422). One blur at a time. The plate is used for that request only and never logged.
- Container app `cevoc-dev-blur-worker`: internal ingress only (reachable as `http://cevoc-dev-blur-worker` from apps in
  the environment, never from the internet), 1 CPU and 2 GiB, scales to zero when idle.
- The app keeps every rule it had: the cache, "still preparing" (503) versus failed (451), fail-closed, one path for demo
  and live. Only where the pipeline runs changes (`ProcessBlurAdapter` with `HttpBlurPipeline`).
- Switch: the app's `CEVOC_BLUR_MODE`. `http` uses the worker; `process` blurs inside the app as before. Both deploy
  workflows take `blur_mode` as an input, so rolling back is a deploy with `blur_mode=process`.
- The earlier queue design (Redis and a shared volume, `worker.py`) is not used: it needs a cache service and file share
  for no gain at this size.
