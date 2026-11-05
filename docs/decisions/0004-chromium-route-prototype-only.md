# 0004. Chromium (headless browser) route is prototype only

Status: Accepted
Date recorded: 2026-11-04
Owner approval: Owner approved the interim search-page provider on 2026-11-04 (recorded in the hand-off log and the deploy workflow comment).

## Chosen
The Chromium route (`browser`, formerly `search-page`, and `browser-link`, Playwright session in `backend/src/live`, `live-browser` Maven profile, live-check endpoints, Chromium layers in the Docker image) exists for the prototype only, behind its adapter, off by default. Production uses API providers. The delete list at cutover is in the detailed notes below (Certificate providers).

## Why
The pages that hold the data have no API today and render with scripts; a browser is the only way to read them in the prototype.

## Ruled out
Making the browser route a production dependency; leaking Chromium or Playwright types outside its adapter.
