# 0021. A normal deploy leaves the owner's environment variables alone

Status: DECIDED (owner design, 2026-11-06); built on branch `envkeep`.

## Context
The lookup adapter and certificate providers are chosen by environment variables the owner sets on the Azure container app. The deploy workflow's non-live job blanked them on every push to main, and the live job set browser values.

## Decision
1. Non-live deploys do not touch `CEVOC_PENALTY_LOOKUP_ADAPTER`, `CEVOC_CERTIFICATES_PROVIDERS`, `CEVOC_SCRAPER_EVIDENCE_URL`, `CEVOC_SCRAPER_EVIDENCE_CONTACT`, `CEVOC_BANNER_OCR_ENABLED`, `CEVOC_LIVECHECK_ENABLED`, `CEVOC_DEMO_DATA_ENABLED` or `CEVOC_CERTIFICATES_SEARCH_PAGE_URL`. They still set image, 0.5 CPU / 1 GiB and one replica.
2. A live-mode deploy (repo variable `LIVE_CHECK_ENABLED` = `true`) keeps setting its values and 2 CPU / 4 GiB.

## Consequences
- A variable never set stays unset and the code default applies (`stub`, nothing external).
- Turning live mode off no longer resets the variables; the owner does that on the container app.
- If the owner selects `browser` while deploying non-live, the app runs at 0.5 CPU / 1 GiB, too small for Chromium, and the post-deploy check posts to `/api/penalty-lookups`, which would reach the real site.
