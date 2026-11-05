# Configuration reference (environment variables)

Names and defaults only. No values, no secrets. Audited 2026-11-06 against `backend/src/main` and `backend/src/live`, `backend/Dockerfile`, `.github/workflows/*`, `scripts/*` and the frontend.

Claims are marked **PROVEN** (read straight from the code or workflow text named) or **INFERRED** (follows from Spring behaviour or from reading, not from a test or a run).

## How a name maps to a property

Every property can be set from an environment variable: upper case, dots and dashes become underscores (`cevoc.demo-data.enabled` is `CEVOC_DEMO_DATA_ENABLED`). INFERRED (standard Spring Boot relaxed binding; the deploy workflow and live-check script rely on it every run). Spring Boot also accepts the dash-less form, which is why both `CEVOC_LIVECHECK_ENABLED` (deploy workflow) and `CEVOC_LIVE_CHECK_ENABLED` (`scripts/live-check.sh`) reach `cevoc.live-check.enabled`. A name that does not map to a property read by the code does nothing.

Scope: **Prototype** = goes away or is replaced before production; **Production** = stays; **Both** = needed in either.
Status: **in use**, **legacy** (still selectable, being replaced), **deprecated** (kept only as a fallback, owner decides retirement).

## 1. Switches and lookup route

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_DEMO_DATA_ENABLED` | `cevoc.demo-data.enabled` | off | Demo adapter, demo hub and demo images exist only when the value is exactly the lowercase word `true`. Unset or anything else (`TRUE`, `1`, `false`) is off. Read only in `DemoDataConfig` (PROVEN; a test enforces it). The old name `CEVOC_DEMO_DATA` is retired: no fallback, no alias (a test proves it is ignored). | Prototype | in use |
| `CEVOC_PENALTY_LOOKUP_ADAPTER` | `cevoc.penalty-lookup.adapter` | `manifest` | `manifest` (manifest first, then live source if `CEVOC_SCRAPER_ENABLED`), `stub`, `scraper-evidence`, `revenue-nsw-http`. PROVEN (`BeanConfig`). | Both | in use |
| `CEVOC_SCRAPER_ENABLED` | `cevoc.scraper.enabled` | `false` | Master switch for live lookup against source sites. With `manifest`, off means unknown numbers answer `LIVE_LOOKUP_DISABLED`. Also one of the three conditions for a live browser session. PROVEN (`BeanConfig`, `ScraperEvidenceFactory`). | Prototype | in use |
| `CEVOC_BANNER_OCR_ENABLED` | `cevoc.banner-ocr.enabled` | `false` | Reads the camera banner text from the first evidence image (Tesseract command line). Bean exists only when `true`. Never used by demo data. PROVEN (`BeanConfig`). | Both | in use |
| `CEVOC_BANNER_OCR_COMMAND` | `cevoc.banner-ocr.command` | `tesseract` | Command to run. PROVEN. | Both | in use |
| `CEVOC_BANNER_OCR_TIMEOUT_SECONDS` | `cevoc.banner-ocr.timeout-seconds` | `30` | Per-image time limit. PROVEN. | Both | in use |

## 2. Evidence scraper (Revenue NSW page, browser route)

All off by default. Needs the site owner's approval before ever being switched on. A live browser session needs ALL of: `CEVOC_PENALTY_LOOKUP_ADAPTER=scraper-evidence`, `CEVOC_SCRAPER_ENABLED=true`, `CEVOC_SCRAPER_EVIDENCE_ENABLED=true`, `CEVOC_SCRAPER_EVIDENCE_BROWSER=playwright`, a base URL and a contact, and the Chromium build (`ScraperEvidenceFactory.liveRequested`, `settings().usable()`; PROVEN for the first four, base URL and contact INFERRED from `usable()`).

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_SCRAPER_EVIDENCE_ENABLED` | `cevoc.scraper.evidence.enabled` | `false` | Evidence scraper on/off. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_BROWSER` | `cevoc.scraper.evidence.browser` | empty | `playwright` selects the browser route; empty means no browser. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_BASE_URL` | `cevoc.scraper.evidence.base-url` | empty | Target site (https). | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_CONTACT` | `cevoc.scraper.evidence.contact` | empty | Contact put in the User-Agent. Required. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_MIN_INTERVAL_MS` | `cevoc.scraper.evidence.min-interval-ms` | `5000` | Minimum gap between requests. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_CONNECT_TIMEOUT_MS` | `cevoc.scraper.evidence.connect-timeout-ms` | `5000` | Connect timeout. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_REQUEST_TIMEOUT_MS` | `cevoc.scraper.evidence.request-timeout-ms` | `15000` | Request timeout. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_CACHE_TTL_SECONDS` | `cevoc.scraper.evidence.cache-ttl-seconds` | `120` | Result cache time. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_MAX_BYTES` | `cevoc.scraper.evidence.max-bytes` | 25 MiB | Size cap per download. | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_BROWSER_HEADLESS` | `cevoc.scraper.evidence.browser-headless` | `true` | `false` shows the browser (local checks only). | Prototype | in use |
| `CEVOC_SCRAPER_EVIDENCE_BROWSER_WARM` | `cevoc.scraper.evidence.browser-warm` | `true` | Keep Chromium up between lookups. | Prototype | in use |
| `CEVOC_BROWSER_CONTAINER` | read with `System.getenv` | `true` in the image (`backend/Dockerfile`) | Tells the Playwright factory it runs in the container, so Chromium launches without its own sandbox. PROVEN (`PlaywrightSessionFactory`). Do not change. | Prototype | in use |

## 3. Live check (owner-run)

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_LIVECHECK_ENABLED` (script uses `CEVOC_LIVE_CHECK_ENABLED`) | `cevoc.live-check.enabled` | `false` | Registers the `/live-check/**` guard, and the controller in the live-browser build. PROVEN. | Prototype | in use |
| `CEVOC_LIVECHECK_TOKEN` | `cevoc.live-check.token` | empty | Value the `X-Live-Check-Token` header must match. **Used only if set. Blank means the live-check endpoints are OPEN while live check is enabled** (PROVEN: `LiveCheckGuard` accepts every request when no token is configured; its Javadoc and `docs/LIVE-CHECK.md` still say "404 when no token", which the code does not do). The deploy workflow sets it blank on every deploy, so a deployed live check is open (PROVEN from the workflow text). | Prototype | in use |
| `CEVOC_LIVE_CHECK_CAPTURE_DIR` | `cevoc.live-check.capture-dir` | empty | Local folder for saved pages during an owner check. Set by `scripts/live-check.sh` only. | Prototype | in use |

## 4. Certificates

Off unless `cevoc.certificates.providers` is non-empty (or the deprecated flag below is true). PROVEN (`BeanConfig`, `CertificateProviders.ids`).

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_CERTIFICATES_PROVIDERS` | `cevoc.certificates.providers` | empty (off) | Ordered list: `search-page`, `search-page-http`, `http-form`, `browser-link`; `tfnsw-api` is listed but throws "not available yet". | Prototype (browser providers); `tfnsw-api` is the production target | in use |
| `CEVOC_CERTIFICATES_APPROVAL_REFERENCE` | `cevoc.certificates.approval-reference` | empty | The owner's approval reference. **Required** by every provider that contacts a source (`search-page`, `search-page-http`, `http-form`); the app refuses to start the provider without it. PROVEN (`CertificateProviders.approval`). | Prototype | in use |
| `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` | `cevoc.certificates.search-page.url` | the basint host search page (`SearchPageCertificateSource.DEFAULT_PAGE_URL`) | Page used by the `search-page` and `search-page-http` providers. PROVEN. | Prototype | in use |
| `CEVOC_CERTIFICATES_CACHE_TTL_SECONDS` | `cevoc.certificates.cache-ttl-seconds` | `300` | Cache time for those two providers. PROVEN. | Prototype | in use |
| `CEVOC_SCRAPER_CERTIFICATES_ENABLED` | `cevoc.scraper.certificates.enabled` | `false` | **Legacy.** Only selects the old `http-form` provider, and only when `cevoc.certificates.providers` is empty. Nothing selected today uses it: the live deploy sets providers to `search-page`. The deploy workflow sets it to `false` on every deploy. PROVEN. | Prototype | legacy |
| `CEVOC_SCRAPER_CERTIFICATES_APPROVAL_REFERENCE` | `cevoc.scraper.certificates.approval-reference` | empty | **Deprecated fallback** for the approval reference when `cevoc.certificates.approval-reference` is empty. Not used by anything selected today (the live deploy sets the new name). Kept, not removed. PROVEN (`CertificateProviders.approval`). | Prototype | deprecated |
| `CEVOC_SCRAPER_CERTIFICATES_*` (`PAGE_URL`, `USER_AGENT`, `MIN_INTERVAL_MS`, `CONNECT_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS`, `CACHE_TTL_SECONDS`, `KEY_STRATEGY`) | `cevoc.scraper.certificates.<key>` | 5000 / 5000 / 10000 ms, 300 s, `VIA_ENFORCEMENT_SITE` | Tuning for the legacy `http-form` provider only. PROVEN. | Prototype | legacy |
| `CEVOC_SCRAPER_CERTIFICATES_WINDOW_MARGIN_MINUTES` | `cevoc.scraper.certificates.window-margin-minutes` | unset (`-1`: whole offence day) | Offence time plus or minus N minutes. Read by `BeanConfig` for the lookup service as well as by `http-form`, so it is not legacy-only. PROVEN. | Prototype | in use |

## 5. Revenue NSW plain-HTTP route

Off unless `CEVOC_PENALTY_LOOKUP_ADAPTER=revenue-nsw-http` AND `CEVOC_REVENUE_NSW_HTTP_ENABLED=true` AND base URL (https, host on the allow-list), path prefix, contact and approval reference are all set. Never the default. All keys are `cevoc.revenue-nsw-http.<key>` (PROVEN, `RevenueNswHttpFactory`).

| Env name | Property key | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_REVENUE_NSW_HTTP_ENABLED` | `enabled` | `false` | Route on/off. | Both | in use |
| `CEVOC_REVENUE_NSW_HTTP_BASE_URL`, `_PATH_PREFIX`, `_CONTACT`, `_APPROVAL_REFERENCE` | `base-url`, `path-prefix`, `contact`, `approval-reference` | empty | Required to turn the route on. | Both | in use |
| `CEVOC_REVENUE_NSW_HTTP_ALLOWED_HOSTS` | `allowed-hosts` | one built-in host (`RevenueNswHttpSettings.DEFAULT_HOST`) | Host allow-list. | Both | in use |
| `CEVOC_REVENUE_NSW_HTTP_AUTHORIZATION_SCHEME`, `_OFFENCE_DATE_FORMAT` | `authorization-scheme`, `offence-date-format` | empty (bare token), `yyyy-MM-dd` | Both UNTESTED against the real service. | Both | in use |
| `CEVOC_REVENUE_NSW_HTTP_MIN_INTERVAL_MS`, `_CONNECT_TIMEOUT_MS`, `_REQUEST_TIMEOUT_MS`, `_MAX_BYTES`, `_SUMMARY_RETRIES`, `_RETRY_BACKOFF_MS` | matching keys | 1000 ms, 5000 ms, 15000 ms, 25 MiB, 1, 2000 ms | Rate and size limits. | Both | in use |

## 6. Media links

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_MEDIA_ADAPTER` | `cevoc.media.adapter` | unset | `stub`, `memory` or `azure-blob`. Unset means `memory` when the lookup adapter is `scraper-evidence`, else `stub`. PROVEN (`BeanConfig`). | Both | in use |
| `CEVOC_MEDIA_BASE_URL` | `cevoc.media.base-url` | `/samples` | Sample files location for the stub adapter. | Prototype | in use |
| `CEVOC_MEDIA_PUBLIC_BASE_URL` | `cevoc.media.public-base-url` | empty (relative links) | Prefix for `/api/media/<token>` links from the memory adapter. | Prototype | in use |
| `CEVOC_MEDIA_MEMORY_RETENTION_MINUTES`, `_MAX_MEGABYTES` | `cevoc.media.memory.retention-minutes`, `.max-megabytes` | `20`, `96` | Memory adapter limits; a restart drops everything. | Prototype | in use |
| `AZURE_STORAGE_CONNECTION_STRING` (referenced as `cevoc.media.azure.connection-string`; no `CEVOC_` prefix) | `cevoc.media.azure.connection-string` | none (no default; the bean fails to start without it) | `azure-blob` only. Secret: never write the value here. Its `application.properties` line is commented out, so the property is set in the portal as `CEVOC_MEDIA_AZURE_CONNECTION_STRING` or by uncommenting the line (INFERRED). | Production | in use |
| `CEVOC_MEDIA_AZURE_CONTAINER` | `cevoc.media.azure.container` | `evidence` | Blob container name. | Production | in use |

## 7. Demo data

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_DEMO_DATA_ENABLED` | `cevoc.demo-data.enabled` | off | See section 1. | Prototype | in use |
| `CEVOC_DEMO_BUNDLE_URL` | `cevoc.demo-bundle.url` | empty (built-in sample content, nothing fetched) | Demo content bundle download (https, no credentials). Read only while the demo switch is on. | Prototype | in use |
| `CEVOC_DEMO_BUNDLE_VERSION`, `CEVOC_DEMO_BUNDLE_SHA256` | `cevoc.demo-bundle.version`, `.sha256` | empty | Both must be set with a URL; any mismatch turns demo content off (the app still starts). | Prototype | in use |
| `CEVOC_DEMO_BUNDLE_TIMEOUT_SECONDS`, `_RETRY_MINUTES` | `cevoc.demo-bundle.timeout-seconds`, `.retry-minutes` | `60` (min 5), `10` (min 1) | Fetch timeout and cool-down after a failure. | Prototype | in use |
| `CEVOC_DEMO_DATA` | `cevoc.demo-data` | n/a | **RETIRED 2026-11-05.** Read by nothing. Safe to delete in the portal. | n/a | dead |

## 8. Web and front end

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_CORS_ALLOWED_ORIGINS` | `cevoc.cors.allowed-origins` | the published Azure Static Web App address (`application.properties`) | Comma-separated origins allowed to call `/api` (and `/live-check`). PROVEN. | Both | in use |
| `VITE_API_BASE_URL` | build-time, `import.meta.env` | empty (same origin, dev proxy) | Backend address baked into the front end at build. Set by `azure-static-web-apps-*.yml` from the GitHub variable `CEVOC_API_BASE_URL`, with a built-in fallback. PROVEN. | Both | in use |
| `server.port` | `server.port` | `8080` | Spring port. Not a `CEVOC_` name. | Both | in use |

## 9. GitHub variables and secrets used by workflows (names only; not container settings)

| Name | Kind | Used by | Notes |
|---|---|---|---|
| `LIVE_CHECK_ENABLED` | variable | backend deploy workflow | Exactly `true` switches the deploy into live mode. Default off. |
| `CEVOC_BASE_URL` | variable | backend deploy workflow (live mode), live-check run | Becomes `CEVOC_SCRAPER_EVIDENCE_BASE_URL` on live deploys. Must be https. |
| `LIVE_CONTACT` | variable | backend deploy workflow (live mode) | Becomes `CEVOC_SCRAPER_EVIDENCE_CONTACT`. |
| `LIVE_CHECK_TOKEN` | secret | backend deploy workflow (live mode), live-check run | Masked in logs, but the live deploy still sets the app's `CEVOC_LIVECHECK_TOKEN` blank (see section 3). |
| `CEVOC_API_BASE_URL` | variable | static web app workflow | Feeds `VITE_API_BASE_URL`. |

The demo flag is deliberately NOT set in any workflow, including the deploy workflow: the owner sets `CEVOC_DEMO_DATA_ENABLED` in the Azure portal.

## 10. Which names the deploy workflow manages (portal edits to these do not stick)

`.github/workflows/cevoc-backend-AutoDeployTrigger-*.yml` runs `az containerapp update --set-env-vars` on every deploy (PROVEN from the workflow text).

- **Every non-live deploy resets:** `CEVOC_PENALTY_LOOKUP_ADAPTER=manifest`, `CEVOC_SCRAPER_ENABLED=false`, `CEVOC_SCRAPER_EVIDENCE_ENABLED=false`, `CEVOC_SCRAPER_CERTIFICATES_ENABLED=false`, `CEVOC_SCRAPER_EVIDENCE_BROWSER` (empty), `CEVOC_LIVECHECK_ENABLED=false`, `CEVOC_LIVECHECK_TOKEN` (empty), `CEVOC_BANNER_OCR_ENABLED=false`, `CEVOC_SCRAPER_EVIDENCE_BASE_URL` (empty), `CEVOC_SCRAPER_EVIDENCE_CONTACT` (empty).
- **Every live deploy sets:** `CEVOC_PENALTY_LOOKUP_ADAPTER=scraper-evidence`, `CEVOC_SCRAPER_ENABLED=true`, `CEVOC_SCRAPER_EVIDENCE_ENABLED=true`, `CEVOC_SCRAPER_EVIDENCE_BROWSER=playwright`, `CEVOC_SCRAPER_CERTIFICATES_ENABLED=false`, `CEVOC_LIVECHECK_ENABLED=true`, `CEVOC_BANNER_OCR_ENABLED=true`, base URL and contact from the GitHub variables, `CEVOC_LIVECHECK_TOKEN` (empty), `CEVOC_CERTIFICATES_PROVIDERS=search-page` and `CEVOC_CERTIFICATES_APPROVAL_REFERENCE` (a fixed reference).
- **Not reset by a non-live deploy, so they persist once a live deploy has set them:** `CEVOC_CERTIFICATES_PROVIDERS` and `CEVOC_CERTIFICATES_APPROVAL_REFERENCE`. INFERRED consequence: after a live deploy, a later non-live deploy keeps the certificate provider configured (it is only reachable through a lookup that needs the scraper route, but check before relying on it).
- **Not touched by the workflow, so portal edits stick:** `CEVOC_DEMO_DATA_ENABLED`, `CEVOC_DEMO_BUNDLE_*`, `CEVOC_CORS_ALLOWED_ORIGINS`, `CEVOC_MEDIA_*`, `CEVOC_REVENUE_NSW_HTTP_*`, `CEVOC_BANNER_OCR_COMMAND` and the other tuning keys.

## 11. Dead names: safe to delete in the Azure portal

Nothing in the code, workflows, Dockerfile or scripts reads these (PROVEN by searching the whole repository for the names and for any property they could map to):

- `CEVOC_EVIDENCE_SCRAPER_ENABLED` (stale hand-added name; the real one is `CEVOC_SCRAPER_EVIDENCE_ENABLED`).
- `CEVOC_CERTIFICATE_SCRAPER_ENABLED` (stale hand-added name; the real certificates settings are in section 4).
- `CEVOC_DEMO_DATA` (the retired demo switch; now ignored).

No other dead name turned up in the repository. The portal itself was not inspected: any `CEVOC_` name in the portal that is not in this document is also read by nothing.

## 12. Owner opinions, tested against the code

Report only. Nothing below is implemented; each removal is a separate follow-up for the owner to approve.

**How the adapter choice differs from the scraper flags (PROVEN, `BeanConfig`, `ManifestFirstPenaltyLookupAdapter`, `ScraperEvidenceFactory`).** `cevoc.penalty-lookup.adapter` picks WHICH lookup bean exists (`manifest`, `stub`, `scraper-evidence`, `revenue-nsw-http`). The scraper flags are second gates inside the chosen bean. With `manifest`, `cevoc.scraper.enabled` only changes the answer for an unknown number: false gives `LIVE_LOOKUP_DISABLED`, true gives `UNAVAILABLE` ("no live source adapter is configured", because `manifest` is built with no live adapter). So under `manifest` the flag selects between two refusals and starts nothing. With `scraper-evidence`, the bean always exists; a browser session is opened only if the browser selector, `cevoc.scraper.enabled` and a usable evidence config are all present, otherwise it has no browser and lookups fail as unavailable.

1. **Remove `CEVOC_SCRAPER_ENABLED`, `CEVOC_SCRAPER_EVIDENCE_ENABLED`, `CEVOC_SCRAPER_CERTIFICATES_ENABLED`.** Readers: `cevoc.scraper.enabled` in `BeanConfig.manifestFirstPenaltyLookup` and `ScraperEvidenceFactory.liveRequested`; `cevoc.scraper.evidence.enabled` in `ScraperSettings.usable()` (also checked by `ScraperEvidenceLookupAdapter`); `cevoc.scraper.certificates.enabled` in `CertificateProviders.ids` and the `BeanConfig` certificates condition. If removed with no other change: under `manifest` the refusal wording would change or need a rule (PROVEN); the `scraper-evidence` adapter would depend on the browser selector plus base URL and contact alone (INFERRED, `usable()` would need rewriting); the certificates flag can go with no loss because the providers list already decides (PROVEN, section 4), though the deploy workflow sets all three and the `live-check.sh` script sets the first two, so both must change together. Proposed replacement: the adapter value is the only switch; add `none`/`manifest` meaning "no live source", and treat a missing base URL, contact or browser as a startup error for `scraper-evidence`. The sequence (workflow, script, tests, docs) is one follow-up change.
2. **Remove `CEVOC_LIVECHECK_ENABLED` and `CEVOC_LIVECHECK_TOKEN`.** Readers: `cevoc.live-check.enabled` in `LiveCheckGuardConfig` (main) and `LiveCheckController` (`src/live`, `@ConditionalOnProperty`); `cevoc.live-check.token` in `LiveCheckGuardConfig`. The purpose is NOT yet gone in the code: `.github/workflows/live-check-run.yml` posts to `/live-check/lookup` on the deployed app, `scripts/live-check.sh` starts a local backend with it on, the front end has `LiveCheck.jsx`, the deploy workflow sets both names, and `docs/LIVE-CHECK.md` documents them (all PROVEN). Removing the flag without removing those would make `/live-check/**` always present in the live-browser build (INFERRED) with no guard at all (the guard bean is conditional on the same flag, PROVEN), which is worse than today's blank-token open mode. Proposed replacement: delete the whole live-check feature (controller, guard, summary, workflow, script, page, docs) as one change, or keep the flag until then. The token is already weak: blank means open (section 3).
3. **`CEVOC_SCRAPER_EVIDENCE_BROWSER` is the Playwright/Chromium selector, headless.** Confirmed in part. PROVEN: it is only compared to `playwright` (`liveRequested`); empty means no browser. Headless is a separate setting, `CEVOC_SCRAPER_EVIDENCE_BROWSER_HEADLESS` (default `true`; the `PlaywrightSessionFactory` takes it as a constructor argument), so the selector itself says nothing about headless. Proposed: keep, or fold into the adapter value (for example `scraper-evidence` implies Playwright, since it is the only browser) and drop the selector.
4. **One fully qualified URL per external address.** `CEVOC_SCRAPER_EVIDENCE_BASE_URL` is read in `ScraperEvidenceFactory.settings` and used as `URI.create(settings.baseUrl())` in `ScraperEvidenceLookupAdapter` (must be https), then `PlaywrightSession.loginUrl`: if the value has no path (or only `/`) the code appends the built-in path `/customer_service/finesonline/`, otherwise it uses the value as given (PROVEN). So today it is a host plus an optional full path; making it the full login URL is a small change, and the host check for navigation uses the host of that URL. Risk (INFERRED): other fixed paths inside `PlaywrightSession` are resolved against the page, so confirm they do not rely on the base alone. Other addresses: the `search-page` provider URL (`CEVOC_CERTIFICATES_SEARCH_PAGE_URL`) and the legacy `http-form` page URL are already full URLs with a built-in default; `CEVOC_REVENUE_NSW_HTTP_BASE_URL` plus `_PATH_PREFIX` is the base-plus-pieces case (PROVEN); `CEVOC_DEMO_BUNDLE_URL` and `CEVOC_CORS_ALLOWED_ORIGINS` are origins, not paths. Proposed: `CEVOC_SCRAPER_EVIDENCE_URL` (full login URL) replacing the base URL, and one `CEVOC_REVENUE_NSW_HTTP_URL` replacing base URL plus path prefix, each following the same rename rules as the demo flag if the owner wants the old names retired with no alias.
5. **Under review.** `CEVOC_MEDIA_PUBLIC_BASE_URL` (`cevoc.media.public-base-url`): read only in `BeanConfig.memoryMedia` and used by `InMemoryMediaAdapter` as a prefix for `/api/media/<token>` links; empty gives relative links (PROVEN). If removed, links are always relative, which works only when the front end and API share an origin; the deployed front end is a separate Static Web App, so relative links would point at the wrong host (INFERRED, check how `evidenceLink` is built in the front end before deciding). Its name is a prefix, so it is the base-plus-pieces pattern from point 4. Keep until the front end resolves relative links against the API address. `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` (`cevoc.certificates.search-page.url`): read in `CertificateProviders.searchPage` and `searchPageHttp`; default is the built-in page URL. If removed, the default would be fixed in code (PROVEN to work, since nothing in any workflow sets it). Safe to remove as an environment setting if the owner is content to change it only in code; it is already a full URL, so it fits point 4.

## 13. Next steps for the owner

1. Delete `CEVOC_EVIDENCE_SCRAPER_ENABLED` and `CEVOC_CERTIFICATE_SCRAPER_ENABLED` in the Azure portal.
2. After this change deploys, set `CEVOC_DEMO_DATA_ENABLED` to `true` (lowercase) on the Container App. Until then the demo is off, because off is now the default.
3. If the old `CEVOC_DEMO_DATA` is still present, delete it (it is ignored).
4. Decide when to retire the deprecated certificate fallbacks (`CEVOC_SCRAPER_CERTIFICATES_ENABLED` and `CEVOC_SCRAPER_CERTIFICATES_APPROVAL_REFERENCE`); nothing selected today needs them.
5. Review section 12 (owner opinions tested against the code) and approve or reject each removal as a follow-up.
6. Decide whether a deployed live check should keep a blank `CEVOC_LIVECHECK_TOKEN` (open endpoints) and whether to correct the "404 when no token" wording in `LiveCheckGuard` and `docs/LIVE-CHECK.md`.
