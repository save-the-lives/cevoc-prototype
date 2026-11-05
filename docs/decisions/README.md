# Decision records

One short record per architectural decision: what was chosen, why, what was ruled out, date, owner approval. The standing document is `docs/ARCHITECTURE.md`. Add a new numbered record for every new architectural decision made in voice or text.

| No. | Decision | Status |
|---|---|---|
| 0001 | Hexagonal design | Accepted |
| 0002 | Cloud-agnostic; Azure MVP only, AWS target | Accepted |
| 0003 | Revenue NSW interim, TfNSW APIs replace it | Accepted |
| 0004 | Chromium route prototype only | Accepted |
| 0005 | Public data only | Accepted |
| 0006 | Existing prototype URLs must not change | Accepted |
| 0007 | Information types, status and per-program switches | PROPOSED (config source and date-ranged versions decided 2026-11-04) |
| 0008 | Vendor-neutrality drift status | Accepted (audit) |
| 0009 | Every returned field travels as a flexible details map (with the field audit) | Accepted direction; build pending |
| 0010 | Three selectable routes per information type; plain HTTP adapter design | Accepted direction; adapter designed, not built or live-tested |
| 0011 | Evidence download and one-file evidence pack | Design for review |
| 0012 | Road safety message rules | Proposal, waiting for the owner |
