# 0003. Revenue NSW is the interim provider; TfNSW APIs replace it

Status: Accepted
Date recorded: 2026-11-04
Owner approval: Stated by the owner in the project hand-off log; the original date of the statement is not recorded here. Seeded into this record on 2026-11-04.

## Chosen
Provider id `revenue-nsw` is interim. TfNSW is the intended source of truth and replaces Revenue NSW concern by concern (penalty details, images, certificates), by changing configuration (`cevoc.certificates.providers`, for example `tfnsw-api,search-page`), not code. Provider knowledge stays inside provider adapters. See `docs/DIRECT-API-ROUTE.md`.

## Why
Revenue NSW holds the penalty and image data today; TfNSW APIs are not available yet.

## Ruled out
Treating Revenue NSW as permanent; letting Revenue NSW field names or URLs into the domain or UI.
