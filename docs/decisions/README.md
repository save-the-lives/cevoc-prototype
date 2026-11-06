# Decision records

One short record per architectural decision: what was chosen, why, what was ruled out, date, owner approval. The standing document is `docs/ARCHITECTURE.md`. Add a new numbered record for every new architectural decision made in voice or text.

| No. | Decision | Status |
|---|---|---|
| 0001 | Hexagonal design | Accepted |
| 0002 | Cloud-agnostic; Azure MVP only, AWS target | Accepted |
| 0003 | Revenue NSW interim, TfNSW APIs replace it | Accepted |
| 0004 | Chromium route temporary (delete at cutover) | Accepted |
| 0005 | Public data only | Accepted |
| 0006 | Existing published URLs must not change | Accepted |
| 0007 | Information types, status and per-program switches | PROPOSED (config source and date-ranged versions decided 2026-11-04) |
| 0008 | Vendor-neutrality drift status | Accepted (audit) |
| 0009 | Every returned field travels as a flexible details map (with the field audit) | Accepted direction; build pending |
| 0010 | Three selectable routes per information type; plain HTTP adapter design | Accepted direction; plain HTTP adapter built and tested offline, not yet live-tested |
| 0011 | Evidence download and one-file evidence pack | Design for review |
| 0012 | Road safety message rules | Proposal; points decided in 0016, schema pending |
| 0013 | Only red light is built now | Decided |
| 0014 | Default program block and switch inheritance | Decided, built (front end config) |
| 0015 | Video on by default, never a download | Decided, built |
| 0016 | Road safety messages: owner decisions (one message, switch, none in PDF) | Decided; engine not built |
| 0017 | Privacy blurring of evidence video and still images | PROPOSED (research only, nothing built) |
| 0018 | Demo content delivered as a separate bundle on a GitHub Release, fail safe | Built; owner approval of the release and its settings pending |
| 0019 | Camera banner read from the image pixels by server-side OCR (Tesseract) | LOCKED by owner decision, 2026-11-05; built |
| 0020 | Scrapers are adapters: one adapter-selection setting (`stub`, `browser`, `http`, later `api`), no per-route switches, no live-check token, one-URL convention | LOCKED by owner direction, 2026-11-06; built |
| 0021 | Owner sets adapter and provider variables on the container app; normal deploys leave them alone | Decided, built |
| 0022 | Real adapters are the defaults (`browser` lookup and certificates); `stub` is explicit; only the contact is required | Decided by owner, 2026-11-06; built |
| 0023 | Certificates: HTTP first with cached browser-session cookies, browser as fallback | Accepted on owner direction, 2026-11-07; built |
| 0024 | Certificates: the `http` provider sends browser headers and is first in the default chain | Owner direction, 2026-11-07; built, not verified live |
| 0025 | Certificates: a `curl` provider (the curl program) is first in the default chain | Owner direction, 2026-11-07; built, not verified live |
