# 0021. A normal deploy leaves the owner's environment variables alone

Status: DECIDED (owner design, 2026-11-06); built (merged to main 2026-11-06).

## Context
The lookup adapter and certificate providers are chosen by environment variables the owner sets on the Azure container app. The deploy workflow's non-live job blanked them on every push to main, and the live job set browser values.

## Decision
1. Non-live deploys do not touch `CEVOC_PENALTY_LOOKUP_ADAPTER`, `CEVOC_CERTIFICATES_PROVIDERS`, `CEVOC_SCRAPER_EVIDENCE_URL`, `CEVOC_SCRAPER_EVIDENCE_CONTACT`, `CEVOC_LIVECHECK_ENABLED`, `CEVOC_DEMO_DATA_ENABLED` or `CEVOC_CERTIFICATES_SEARCH_PAGE_URL`. They set the image and one replica only. They do not set CPU or memory: the owner sets 2 CPU / 4Gi once in the Azure portal (Chromium needs it).
2. A live-mode deploy (repo variable `LIVE_CHECK_ENABLED` = `true`) keeps setting its values and raises the app to 2 CPU / 4 GiB only if it is currently smaller; it never shrinks it.
3. The normal post-deploy check is `GET /api/ping` (new, answers `ok`, touches no adapter or network). It no longer posts to `/api/penalty-lookups`. Live mode keeps checking `/live-check/ping`.

## Consequences
- A variable never set stays unset and the code default applies (since record 0022, the real `browser` adapter and provider, inert until the contact is set; before it, `stub`).
- Turning live mode off no longer resets the variables; the owner does that on the container app.
- If the owner selects `browser` while deploying non-live, the size stays whatever the owner set (2 CPU / 4Gi), and the post-deploy check cannot reach the real site.
- If the owner never sets the size, the app keeps whatever it already has; the workflow will not fix a too-small app on a normal deploy.
