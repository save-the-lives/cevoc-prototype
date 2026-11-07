# 0020. Scrapers are adapters: one adapter-selection setting, no per-route switches

Status: LOCKED (owner direction, agreed several times, 2026-11-06); built.

## Plan note (short)
- **Selector:** `cevoc.penalty-lookup.adapter` (env `CEVOC_PENALTY_LOOKUP_ADAPTER`) is kept, with new values: `stub` (default; also when empty or unset), `browser` (Chromium, Playwright), `http` (plain request route, the Revenue NSW HTTP adapter), `api` (direct API; reserved, selecting it stops start-up until it is built). Certificates keep their own ordered selector, `cevoc.certificates.providers`, folded into the same names: `browser`, `http`, `api` (plus the legacy `http-form` and `browser-link`).
- **Default:** the default used to be `manifest` (manifest first, then "live lookup switched off" while the scraper flag was false), not the old `stub` class. The behaviour is kept exactly and is now called `stub`, the owner's word. The old sample-only stub class is no longer selectable.
- **Removed, no fallback, no alias:** `CEVOC_SCRAPER_ENABLED`, `CEVOC_SCRAPER_EVIDENCE_ENABLED`, `CEVOC_SCRAPER_CERTIFICATES_ENABLED` (and the `http-form` fallback it triggered), `CEVOC_SCRAPER_EVIDENCE_BROWSER`, `CEVOC_LIVECHECK_TOKEN`, `CEVOC_REVENUE_NSW_HTTP_ENABLED`, `cevoc.scraper.certificates.approval-reference`, `CEVOC_SCRAPER_EVIDENCE_BASE_URL` (replaced by `CEVOC_SCRAPER_EVIDENCE_URL`), the old adapter values `manifest`, `scraper-evidence`, `revenue-nsw-http` and the old certificate names `search-page`, `search-page-http`, `tfnsw-api`. An unknown adapter value is treated as the safe default with a warning; an unknown certificate name is ignored with a warning.
- **Kept:** `CEVOC_LIVECHECK_ENABLED` (off by default), `CEVOC_SCRAPER_EVIDENCE_CONTACT` (not redundant: it builds the identifying User-Agent), the demo settings, CORS and media settings. `CEVOC_BANNER_OCR_ENABLED` was later removed: banner OCR is now always available and used by the scraping adapter when active.
- **Approval reference:** now an optional recorded note for the certificates providers (logged when present); it no longer stops start-up. The plain HTTP route still lists it among its own required settings.

## Context
Each lookup route had its own on/off switch on top of the adapter choice, so one route needed up to six settings to run and several were checked in different places. The owner's direction: a route is just another adapter against the canonical port, chosen by one setting; a scraper is off simply because it is not selected.

## Decision
1. One adapter-selection setting for the lookup (above). `BeanConfig.penaltyLookup` is the only place that maps the value to an adapter (`config.LookupAdapterKind` parses it). Ports stay in application, engines in adapters, no engine type in the domain; `ArchitectureTest` is unchanged and green.
2. No per-route on/off switches. Being selected is the switch. A selected route that is not fully configured (browser without URL or contact, http without its settings) answers "switched off" and makes no network call.
3. Live check keeps its own switch (`CEVOC_LIVECHECK_ENABLED`, off by default) and the one-lookup-at-a-time safeguard. The token is gone: while live check is enabled the endpoints are open, and otherwise they do not exist (404). The earlier Javadoc and docs line "404 when no token" was wrong and is corrected.
4. **External URL convention (standing rule):** any external URL is ONE fully qualified URL setting, not a base plus pieces built in code; the only exception is where the code must add its own request parameters (form post or query values), kept minimal. Converted now: `CEVOC_SCRAPER_EVIDENCE_URL` (the full login page address; a host-only value is still completed with the built-in path so an unchanged GitHub variable does not break). Everything else is listed with its proposed fully qualified form in `docs/CONFIG-REFERENCE.md` section 8a, with behaviour unchanged.
5. Migration: the code starts and behaves safely with ALL old variables absent, and also with them still set (they are read by nothing). The deploy workflow's non-live mode sets the adapter back to the default (empty) and live mode sets only the new names. Tests prove the default, each value's bean, the ignored old names and values, and the start-up with no settings.

## Ruled out
- Aliases or fallbacks for the old names (owner: retire them).
- Failing start-up on a missing URL or contact for `browser`: the deploy workflow already checks them, and a refusal at lookup time is the existing, safer behaviour.

## Consequences
The direct API arrives as the `api` value of the same setting, with no new enable flag. Removing a route later is deleting its adapter and one `case` in `BeanConfig`.
