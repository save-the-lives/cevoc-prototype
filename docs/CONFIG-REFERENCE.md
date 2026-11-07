# Configuration reference (environment variables)

Names and defaults only. No values, no secrets. Audited 2026-11-06, updated for the scrapers-as-adapters change (record 0020) and for real adapters as the defaults (record 0022) against `backend/src/main` and `backend/src/live`, `backend/Dockerfile`, `.github/workflows/*`, `scripts/*` and the frontend.

Claims are marked **PROVEN** (read straight from the code or workflow text named) or **INFERRED** (follows from Spring behaviour or from reading, not from a test or a run).

## How a name maps to a property

Every property can be set from an environment variable: upper case, dots and dashes become underscores (`cevoc.demo-data.enabled` is `CEVOC_DEMO_DATA_ENABLED`). INFERRED (standard Spring Boot relaxed binding; the deploy workflow and live-check script rely on it every run). Spring Boot also accepts the dash-less form, which is why both `CEVOC_LIVECHECK_ENABLED` (deploy workflow) and `CEVOC_LIVE_CHECK_ENABLED` (`scripts/live-check.sh`) reach `cevoc.live-check.enabled`. A name that does not map to a property read by the code does nothing.

Scope: **Temporary** = goes away or is replaced at cutover (delete at cutover); **Production** = stays; **Both** = needed in either.
Status: **in use**, **legacy** (still selectable when listed, being replaced), **REMOVED** (read by nothing; no fallback, no alias; safe to delete in the portal).

**Two standing rules (record 0020).** (1) Every lookup route is an adapter behind the same port, chosen by ONE adapter-selection setting; there are no per-route on/off switches. (2) Any external address is ONE fully qualified URL setting, not a base plus pieces built in code; the only exception is where the code must add its own request parameters (form post or query values), kept minimal. Section 8a lists the places that do not follow rule 2 yet.

## 0. Audit result: what must be set in Azure (record 0022)

The lookup adapter and the certificate providers are hexagonal adapters, so the default configuration is already the real one: with nothing set, the lookup uses the Chromium (`browser`) adapter, certificates use `curl`, then `http`, then `browser` (the curl program first, plain HTTP with browser headers next, the browser as last fallback), the evidence address and the certificates page address are the built-in fully qualified URLs, demo data is off and live check is off. The one thing with no sensible default is the contact, so it is the only variable the owner must set.

**The minimal set to keep in Azure (names only):**

| Name | Class | Why |
|---|---|---|
| `CEVOC_SCRAPER_EVIDENCE_CONTACT` | `cevoc.scraper.evidence.contact` | none (REQUIRED) | **Required; no sensible default.** Contact put in the User-Agent (the identifying User-Agent of every scraper route and of the `http` certificates provider is built from it, and no other setting carries it). Blank: no crash; one error line at start-up, and lookups and certificate checks answer "not available". | Temporary | in use |

Everything else below is optional. Keep these only if you want the behaviour they switch on:

| Name | Class | Keep when |
|---|---|---|
| `CEVOC_BANNER_OCR_COMMAND` | optional override (default `tesseract`) | only if the OCR command differs |
| `CEVOC_DEMO_DATA_ENABLED` | optional override (default off) | the environment is for demonstrations (never with a real audience) |
| `CEVOC_LIVECHECK_ENABLED` | optional override (default `false`) | only while the owner is running a live check; delete afterwards |
| `CEVOC_EVIDENCE_PROVIDERS` | `cevoc.evidence.providers` | empty (falls back to legacy) | **Preferred override.** Ordered list of evidence providers (e.g. `http,browser`). Takes precedence over `CEVOC_PENALTY_LOOKUP_ADAPTER` when set. |
| `CEVOC_PENALTY_LOOKUP_ADAPTER` | `cevoc.penalty-lookup.adapter` | `browser` (also when empty or unset) | **Legacy; prefer `CEVOC_EVIDENCE_PROVIDERS`.** Optional override. The single-value setting that picks the lookup route. Ignored when `CEVOC_EVIDENCE_PROVIDERS` is set. |
| `CEVOC_CERTIFICATES_PROVIDERS` | `cevoc.certificates.providers` | `curl,http,browser` (when empty or unset) | **Optional override.** Ordered list of: `curl` (same search, each request run by the `curl` command line program; needs no contact; see `docs/decisions/0025-certificates-curl-provider.md`), `browser` (certificates search page in headless Chromium; formerly `search-page`), `http` (same page with plain requests; formerly `search-page-http`; without a contact it logs the missing contact and runs without this source, it no longer stops start-up), `api` (reserved; listing it stops start-up with "not available yet"; formerly `tfnsw-api`), the legacy `http-form` and `browser-link`, and `none` (explicit: no certificate source). A name not in this list, including the three retired names, is ignored with a warning and never stops start-up; a value that lists nothing known leaves no certificate source. | Temporary (browser providers); `api` is the production target | in use |
| `CEVOC_SCRAPER_EVIDENCE_URL`, `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` | optional override | only if the site address moves; a full `https://` URL |
| `CEVOC_CORS_ALLOWED_ORIGINS` | optional override | only if the front end address changes (default is the current static web app address) |
| `CEVOC_MEDIA_*`, `AZURE_STORAGE_CONNECTION_STRING` | optional override | only for `azure-blob` media or a cross-host public link prefix |
| `CEVOC_DEMO_BUNDLE_*` | optional override | only with a demo content bundle |

**Safe to delete in the portal now:** `CEVOC_PENALTY_LOOKUP_ADAPTER` and `CEVOC_CERTIFICATES_PROVIDERS` when they hold `browser` (that is the default; `stub` or an old value means you are choosing something else, see section 13), `CEVOC_SCRAPER_EVIDENCE_URL` when it holds the Revenue NSW login page, `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` when it holds the default, `CEVOC_LIVECHECK_ENABLED` when no check is running, `CEVOC_BANNER_OCR_ENABLED` (no longer read; banner OCR is inferred from adapter choice), `CEVOC_CERTIFICATES_APPROVAL_REFERENCE` (no longer read by anything), all tuning keys (`*_MIN_INTERVAL_MS`, `*_TIMEOUT*`, `*_CACHE_TTL_SECONDS`, `*_MAX_BYTES`, `*_BROWSER_HEADLESS`, `*_BROWSER_WARM`, `CEVOC_BANNER_OCR_COMMAND`, `CEVOC_BANNER_OCR_TIMEOUT_SECONDS`, `CEVOC_SCRAPER_CERTIFICATES_*`) unless you changed one on purpose, and every REMOVED name (section 11).

**Audit method:** every `CEVOC_` name in this document was matched against the code (`backend/src/main`, `backend/src/live`), `backend/Dockerfile`, `.github/workflows/*` and `scripts/*`. Every name not listed as REMOVED is read by something; `CEVOC_CERTIFICATES_APPROVAL_REFERENCE` was the only one whose only effect was a log line, so it was removed from the code in this change.

## 1. Adapter selection and switches

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_EVIDENCE_PROVIDERS` | `cevoc.evidence.providers` | empty (falls back to `CEVOC_PENALTY_LOOKUP_ADAPTER`) | **Preferred.** Ordered comma-separated list of evidence providers tried left to right: `http` (plain HTTP route), `browser` (Chromium route), `stub` (bundled fictitious data), `api` (reserved; stops start-up). `http,browser` activates the adaptive circuit-breaker adapter (try HTTP first, fall to browser). A single value like `browser` selects just that adapter. When set, takes precedence over `CEVOC_PENALTY_LOOKUP_ADAPTER`. When unset or empty, the legacy single-value setting is used. PROVEN (`EvidenceProviders`, `BeanConfig.penaltyLookup`, `PenaltyLookupAdapterSelectionTest`). | Both | in use |
| `CEVOC_PENALTY_LOOKUP_ADAPTER` | `cevoc.penalty-lookup.adapter` | `browser` (also when empty or unset) | **Legacy; prefer `CEVOC_EVIDENCE_PROVIDERS`.** The single-value setting that picks the lookup route. `browser`: the default (Chromium route). `stub`: bundled fictitious notices. `http`: plain request route (section 5). `adaptive`: circuit-breaker (HTTP then browser). `api`: reserved. Any other value falls back to `stub` with a warning. Ignored when `CEVOC_EVIDENCE_PROVIDERS` is set. PROVEN (`LookupAdapterKind`, `BeanConfig.penaltyLookup`, `PenaltyLookupAdapterSelectionTest`). | Both | in use |
| `CEVOC_BANNER_OCR_ENABLED` | `cevoc.banner-ocr.enabled` | n/a | **REMOVED.** Banner OCR is now always available; the scraping adapter uses it when active. No separate switch needed. | n/a | REMOVED |
| `CEVOC_BANNER_OCR_COMMAND` | `cevoc.banner-ocr.command` | `tesseract` | Command to run. PROVEN. | Both | in use |
| `CEVOC_BANNER_OCR_TIMEOUT_SECONDS` | `cevoc.banner-ocr.timeout-seconds` | `30` | Per-image time limit. PROVEN. | Both | in use |
| `CEVOC_DEMO_DATA_ENABLED` | `cevoc.demo-data.enabled` | off | Demo adapter, demo hub and demo images exist only when the value is exactly the lowercase word `true`. See section 7. | Temporary | in use |
| `CEVOC_SCRAPER_ENABLED` | `cevoc.scraper.enabled` | n/a | **REMOVED (record 0020).** Read by nothing. Selecting the adapter replaces it. | n/a | REMOVED |
| `CEVOC_SCRAPER_EVIDENCE_ENABLED` | `cevoc.scraper.evidence.enabled` | n/a | **REMOVED.** Read by nothing. | n/a | REMOVED |
| `CEVOC_SCRAPER_EVIDENCE_BROWSER` | `cevoc.scraper.evidence.browser` | n/a | **REMOVED.** Chromium is simply the `browser` adapter. | n/a | REMOVED |
| `CEVOC_REVENUE_NSW_HTTP_ENABLED` | `cevoc.revenue-nsw-http.enabled` | n/a | **REMOVED.** Redundant with the selector: the route exists only when `CEVOC_PENALTY_LOOKUP_ADAPTER=http`. | n/a | REMOVED |

## 2. Browser (Chromium) route, adapter `browser`

The default route. A live browser session needs: the `browser` adapter (the default), a URL (has a default), a contact (REQUIRED, no default) and the Chromium build (the `live-browser` Maven profile, which the Docker image always includes). Without a contact the adapter makes no network call, the start-up log says so in one error line naming `CEVOC_SCRAPER_EVIDENCE_CONTACT`, and every lookup answers the existing "switched off" message (PROVEN, `ScraperSettings.usable`, `ScraperEvidenceFactory.logNotUsable`, `ScraperDefaultsTest`). The local development runs and tests that must not touch the site select `stub` and `none` explicitly.

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_SCRAPER_EVIDENCE_URL` | `cevoc.scraper.evidence.url` | `https://www.apps09.revenue.nsw.gov.au/customer_service/finesonline/` (`ScraperSettings.DEFAULT_URL`; also when empty or blank) | **Optional override.** The one fully qualified https address of the site's login page. The host is the one observed in the network map (`docs/DIRECT-API-ROUTE.md`) and the path is the one the Chromium session already used. A value with no path (host only) is still completed with the built-in login path, so an older GitHub variable that holds only the origin keeps working. The retired name `CEVOC_SCRAPER_EVIDENCE_BASE_URL` is read by nothing (no alias; a test proves it). | Temporary | in use |
| `CEVOC_SCRAPER_EVIDENCE_BASE_URL` | `cevoc.scraper.evidence.base-url` | n/a | **REMOVED.** Replaced by `CEVOC_SCRAPER_EVIDENCE_URL`. | n/a | REMOVED |
| `CEVOC_SCRAPER_EVIDENCE_CONTACT` | `cevoc.scraper.evidence.contact` | empty | Contact put in the User-Agent. Kept: it is not redundant (the identifying User-Agent of every scraper route and of the `http` certificates provider is built from it, and no other setting carries it). | Temporary | in use |
| `CEVOC_SCRAPER_EVIDENCE_MIN_INTERVAL_MS` | `cevoc.scraper.evidence.min-interval-ms` | `5000` | Minimum gap between requests. | Temporary | in use; optional override, safe to delete |
| `CEVOC_SCRAPER_EVIDENCE_CONNECT_TIMEOUT_MS` | `cevoc.scraper.evidence.connect-timeout-ms` | `5000` | Connect timeout. | Temporary | in use; optional override, safe to delete |
| `CEVOC_SCRAPER_EVIDENCE_REQUEST_TIMEOUT_MS` | `cevoc.scraper.evidence.request-timeout-ms` | `15000` | Request timeout. | Temporary | in use; optional override, safe to delete |
| `CEVOC_SCRAPER_EVIDENCE_CACHE_TTL_SECONDS` | `cevoc.scraper.evidence.cache-ttl-seconds` | `120` | Result cache time. | Temporary | in use; optional override, safe to delete |
| `CEVOC_SCRAPER_EVIDENCE_MAX_BYTES` | `cevoc.scraper.evidence.max-bytes` | 25 MiB | Size cap per download. | Temporary | in use; optional override, safe to delete |
| `CEVOC_SCRAPER_EVIDENCE_BROWSER_HEADLESS` | `cevoc.scraper.evidence.browser-headless` | `true` | `false` shows the browser (local checks only). | Temporary | in use; optional override, safe to delete |
| `CEVOC_SCRAPER_EVIDENCE_BROWSER_WARM` | `cevoc.scraper.evidence.browser-warm` | `true` | Keep Chromium up between lookups. | Temporary | in use; optional override, safe to delete |
| `CEVOC_BROWSER_CONTAINER` | read with `System.getenv` | `true` in the image (`backend/Dockerfile`) | Tells the Playwright factory it runs in the container, so Chromium launches without its own sandbox. PROVEN (`PlaywrightSessionFactory`). Do not change. | Temporary | in use |

## 3. Live check (owner-run)

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_LIVECHECK_ENABLED` (script uses `CEVOC_LIVE_CHECK_ENABLED`) | `cevoc.live-check.enabled` | `false` | Registers the `/live-check/**` guard, and the controller in the live-browser build. While it is `true` the endpoints are OPEN (no token); `LiveCheckGuard` keeps the one-lookup-at-a-time safeguard (a second concurrent lookup gets 429). When it is not `true` neither exists and `/live-check/**` answers 404. PROVEN (`LiveCheckGuardTest`). | Temporary | in use |
| `CEVOC_LIVECHECK_TOKEN` | `cevoc.live-check.token` | n/a | **REMOVED.** The token guard is gone; the header `X-Live-Check-Token` is ignored. The stale "404 when no token" wording is corrected in the Javadoc and in `docs/LIVE-CHECK.md`. | n/a | REMOVED |
| `CEVOC_LIVE_CHECK_CAPTURE_DIR` | `cevoc.live-check.capture-dir` | empty | Local folder for saved pages during an owner check. Set by `scripts/live-check.sh` only. | Temporary | in use |

## 4. Certificates (the certificates adapter choice)

The default certificate providers are `curl`, `http`, `browser`, tried in that order (the first that answers ends the chain; a failure, including a refusal of the curl leg, hands over to the next). It uses the same names as the lookup adapter. PROVEN (`BeanConfig`, `CertificateProviders.ids`, `CertificateProvidersTest`).

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_CERTIFICATES_PROVIDERS` | `cevoc.certificates.providers` | empty (off) | Ordered list of: `curl` (same search, each request run by the `curl` command line program; needs no contact; see `docs/decisions/0025-certificates-curl-provider.md`), `browser` (certificates search page in headless Chromium; formerly `search-page`), `http` (same page with plain requests; formerly `search-page-http`), `api` (reserved; listing it stops start-up with "not available yet"; formerly `tfnsw-api`), and the legacy `http-form` and `browser-link`. A name not in this list, including the three retired names, is ignored with a warning and never stops start-up. | Temporary (browser providers); `api` is the production target | in use |
| `CEVOC_CERTIFICATES_APPROVAL_REFERENCE` | `cevoc.certificates.approval-reference` | n/a | **REMOVED (record 0022).** It only wrote a log line and nothing required it. Read by nothing now; safe to delete. | n/a | REMOVED |
| `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` | `cevoc.certificates.search-page.url` | `https://cevoc.transport.nsw.gov.au/cevoc/pages/sdro/searchCertificates.jsf` (`CertificateScraperProperties.DEFAULT_PAGE_URL`) | Page used by the `browser` and `http` providers. Already one full URL. **Optional override.** PROVEN. | Temporary | in use |
| `CEVOC_CERTIFICATES_SEARCH_PAGE_BROWSER_DEFAULT_USER_AGENT` | `cevoc.certificates.search-page.browser-default-user-agent` | `true` | The `browser` certificates provider uses Chromium's own user agent as sent when headed (built from the launched browser version, no "Headless" in it; no header added or faked) because the page's bot management answered 403 to the identifying agent. The penalty lookup keeps the identifying agent. `false` restores the identifying agent for this page. Owner-approved 2026-11-07. **Optional override.** | Temporary | in use |
| `CEVOC_CERTIFICATES_CURL_COMMAND` | `cevoc.certificates.curl.command` | `curl` | Program run by the `curl` certificates provider. The image installs curl (`backend/Dockerfile`). **Optional override.** | Temporary | in use |
| `CEVOC_CERTIFICATES_CURL_TIMEOUT_SECONDS` | `cevoc.certificates.curl.timeout-seconds` | `10` | Connect timeout and total time limit of each curl request (`--connect-timeout`, `--max-time`). **Optional override.** | Temporary | in use |
| `CEVOC_CERTIFICATES_SEARCH_PAGE_HTTP_BROWSER_HEADERS` | `cevoc.certificates.search-page.http-browser-headers` | `true` | The `http` certificates provider sends the headers of a desktop Chrome navigation (Chrome user agent, Accept, Accept-Language en-AU, Sec-Fetch-Site/Mode/Dest/User, Upgrade-Insecure-Requests, sec-ch-ua; Referer and Origin on the form POST; Accept-Encoding gzip, inflated by the fetcher) because the page's bot management refuses the identifying agent and every automated browser. `false`: identifying agent. A refusal (403) of this leg hands over to `browser` (the chain does not stop); `browser`'s own refusal still stops it. Logs method, status and milliseconds, then form fetched / view state found / results parsed / count; never values. See `docs/decisions/0024-certificates-http-browser-headers.md`. Owner-approved 2026-11-07. **Optional override.** | Temporary | in use |
| `CEVOC_CERTIFICATES_SEARCH_PAGE_HTTP_FIRST` | `cevoc.certificates.search-page.http-first` | `true` | The `browser` certificates provider first tries plain HTTP with the cookies (JSESSIONID, ak_bmsc, bm_sv; in memory, 15 minutes, one replica) left by the last browser visit, and falls back to the browser on any failure, which refreshes them. `false`: always the browser. See `docs/decisions/0023-certificates-http-first.md`. **Optional override.** | Temporary | in use |
| `CEVOC_CERTIFICATES_CACHE_TTL_SECONDS` | `cevoc.certificates.cache-ttl-seconds` | `300` | Cache time for those two providers. PROVEN. | Temporary | in use |
| `CEVOC_SCRAPER_CERTIFICATES_ENABLED` | `cevoc.scraper.certificates.enabled` | n/a | **REMOVED** (including its legacy fallback that selected `http-form` when the list was empty). List `http-form` in the providers if it is ever wanted. | n/a | REMOVED |
| `CEVOC_SCRAPER_CERTIFICATES_APPROVAL_REFERENCE` | `cevoc.scraper.certificates.approval-reference` | n/a | **REMOVED** (was a deprecated fallback). | n/a | REMOVED |
| `CEVOC_SCRAPER_CERTIFICATES_*` (`PAGE_URL`, `USER_AGENT`, `MIN_INTERVAL_MS`, `CONNECT_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS`, `CACHE_TTL_SECONDS`, `KEY_STRATEGY`) | `cevoc.scraper.certificates.<key>` | 5000 / 5000 / 10000 ms, 300 s, `VIA_ENFORCEMENT_SITE` | Tuning for the legacy `http-form` provider only. PROVEN. | Temporary | legacy |
| `CEVOC_SCRAPER_CERTIFICATES_WINDOW_MARGIN_MINUTES` | `cevoc.scraper.certificates.window-margin-minutes` | unset (`-1`: whole offence day) | Offence time plus or minus N minutes. Read by `BeanConfig` for the lookup service as well as by `http-form`, so it is not legacy-only. PROVEN. | Temporary | in use |

**Log lines for the certificates step.** Every lookup now leaves a line in the container console logs (in Azure: `ContainerAppConsoleLogs_CL`), so a failing certificates step can be found without running the live check. The lines hold fixed words and numbers only: never a notice number, plate, camera code, personal data or page content. Search for `Certificates step` first, then the logger lines below it.

| Logger | Level | Line |
|---|---|---|
| `LookupPenaltyService` | INFO | `Certificates step ok: count=2, duration=1234ms` |
| `LookupPenaltyService` | WARN | `Certificates step failed: cause=blocked-403, duration=889ms` (cause is the same fixed word as the step trace: `timeout`, `network-error`, `blocked-401`, `blocked-403`, `blocked-429`, `captcha`, `no-search-form`, `source-failed` and so on) |
| `LookupPenaltyService` | INFO | `Certificates step skipped: reason=source-disabled`, `no-camera-code`, `supplied-by-adapter` or `not-applicable` |
| `CertificateProviderChain` (two or more providers) | INFO / WARN | `Certificate provider ok: provider=http, count=0`; `Certificate provider failed: provider=browser, cause=timeout, refusal=false, chain-stopped=false` (a refusal, `blocked-401/403/429`, stops the chain) |
| `SearchPageCertificateSource` (`browser`) | INFO | `Certificate search page ok: count=5, cache=miss` or `cache=hit` |
| `SearchPageCertificateSource` | WARN | `Certificate search page failed: step=certificates; cause=blocked-403` |
| `SearchPageCertificateSource` | DEBUG | `Certificate cache evicted: count=1` |
| `CertificateProviders` (start-up) | INFO / WARN | `Certificate source: providers=[browser], url=https://cevoc.transport.nsw.gov.au/...` and the browser-route warning, which also carries the providers and the URL |

A single provider is used without the chain, so its failures appear on the `SearchPageCertificateSource` line only. To see the DEBUG line set `LOGGING_LEVEL_CEVOC_ADAPTER_OUT_SCRAPER=DEBUG` (standard Spring Boot logging variable; not a `CEVOC_` name).

The `browser` certificates provider opens its own Chromium session and, like the evidence route, needs the live-browser build and `CEVOC_SCRAPER_EVIDENCE_CONTACT` (the URL has a default); the `http` provider needs the contact. The legacy `CEVOC_SCRAPER_CERTIFICATES_*` tuning keys apply to `http-form` only: safe to delete.

## 5. Revenue NSW plain-HTTP route, adapter `http`

Exists only when `CEVOC_PENALTY_LOOKUP_ADAPTER=http`. It then does nothing unless base URL (https, host on the allow-list), path prefix, contact and approval reference are all set; otherwise lookups answer "switched off". Never the default. Every name here is an optional override, needed only when the `http` adapter is chosen. All keys are `cevoc.revenue-nsw-http.<key>` (PROVEN, `RevenueNswHttpFactory`). The approval reference is still required by this route (only the certificates providers dropped the requirement).

| Env name | Property key | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_REVENUE_NSW_HTTP_ENABLED` | `enabled` | n/a | **REMOVED.** Redundant with the selector. | n/a | REMOVED |
| `CEVOC_REVENUE_NSW_HTTP_BASE_URL`, `_PATH_PREFIX`, `_CONTACT`, `_APPROVAL_REFERENCE` | `base-url`, `path-prefix`, `contact`, `approval-reference` | empty | Required to use the route. Base URL plus path prefix is the base-plus-pieces case (section 8a). | Both | in use |
| `CEVOC_REVENUE_NSW_HTTP_ALLOWED_HOSTS` | `allowed-hosts` | one built-in host (`RevenueNswHttpSettings.DEFAULT_HOST`) | Host allow-list. | Both | in use |
| `CEVOC_REVENUE_NSW_HTTP_AUTHORIZATION_SCHEME`, `_OFFENCE_DATE_FORMAT` | `authorization-scheme`, `offence-date-format` | empty (bare token), `yyyy-MM-dd` | Both UNTESTED against the real service. | Both | in use |
| `CEVOC_REVENUE_NSW_HTTP_MIN_INTERVAL_MS`, `_CONNECT_TIMEOUT_MS`, `_REQUEST_TIMEOUT_MS`, `_MAX_BYTES`, `_SUMMARY_RETRIES`, `_RETRY_BACKOFF_MS` | matching keys | 1000 ms, 5000 ms, 15000 ms, 25 MiB, 1, 2000 ms | Rate and size limits. | Both | in use |

## 6. Media links

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_MEDIA_ADAPTER` | `cevoc.media.adapter` | unset | `stub`, `memory` or `azure-blob`. Unset means `memory` when the lookup adapter is `browser` or `http`, else `stub`. PROVEN (`BeanConfig`). | Both | in use |
| `CEVOC_MEDIA_BASE_URL` | `cevoc.media.base-url` | `/samples` | Sample files location for the stub adapter. | Temporary | in use |
| `CEVOC_MEDIA_PUBLIC_BASE_URL` | `cevoc.media.public-base-url` | empty (relative links) | Prefix for `/api/media/<token>` links from the memory adapter. | Temporary | in use |
| `CEVOC_MEDIA_MEMORY_RETENTION_MINUTES`, `_MAX_MEGABYTES` | `cevoc.media.memory.retention-minutes`, `.max-megabytes` | `20`, `96` | Memory adapter limits; a restart drops everything. | Temporary | in use |
| `AZURE_STORAGE_CONNECTION_STRING` (referenced as `cevoc.media.azure.connection-string`; no `CEVOC_` prefix) | `cevoc.media.azure.connection-string` | none (no default; the bean fails to start without it) | `azure-blob` only. Secret: never write the value here. Its `application.properties` line is commented out, so the property is set in the portal as `CEVOC_MEDIA_AZURE_CONNECTION_STRING` or by uncommenting the line (INFERRED). | Production | in use |
| `CEVOC_MEDIA_AZURE_CONTAINER` | `cevoc.media.azure.container` | `evidence` | Blob container name. | Production | in use |

## 7. Demo data

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_DEMO_DATA_ENABLED` | `cevoc.demo-data.enabled` | off (optional override) | See section 1. While on, it also puts a sample certificate source in front of the configured certificate providers (`cevoc.certificates.providers`): the 43 demo cases get invented certificate results at step 8, and any other camera code still goes to the configured providers, unchanged. No new setting; the providers `browser`, `http` and `api` are not touched. Off: no sample certificate source exists. | Temporary | in use |
| `CEVOC_DEMO_BUNDLE_URL` | `cevoc.demo-bundle.url` | empty (built-in sample content, nothing fetched) | Demo content bundle download (https, no credentials). Read only while the demo switch is on. | Temporary | in use |
| `CEVOC_DEMO_BUNDLE_VERSION`, `CEVOC_DEMO_BUNDLE_SHA256` | `cevoc.demo-bundle.version`, `.sha256` | empty | Both must be set with a URL; any mismatch turns demo content off (the app still starts). | Temporary | in use |
| `CEVOC_DEMO_BUNDLE_TIMEOUT_SECONDS`, `_RETRY_MINUTES` | `cevoc.demo-bundle.timeout-seconds`, `.retry-minutes` | `60` (min 5), `10` (min 1) | Fetch timeout and cool-down after a failure. | Temporary | in use |
| `CEVOC_DEMO_DATA` | `cevoc.demo-data` | n/a | **RETIRED 2026-11-05.** Read by nothing. Safe to delete in the portal. | n/a | dead |

## 8. Web and front end

| Env name | Property | Default | What it does | Scope | Status |
|---|---|---|---|---|---|
| `CEVOC_CORS_ALLOWED_ORIGINS` | `cevoc.cors.allowed-origins` | the published Azure Static Web App address (`application.properties`) | Comma-separated origins allowed to call `/api` (and `/live-check`). PROVEN. | Both | in use |
| `VITE_API_BASE_URL` | build-time, `import.meta.env` | empty (same origin, dev proxy) | Backend address baked into the front end at build. Set by `azure-static-web-apps-*.yml` from the GitHub variable `CEVOC_API_BASE_URL`, with a built-in fallback. PROVEN. | Both | in use |
| `server.port` | `server.port` | `8080` | Spring port. Not a `CEVOC_` name. | Both | in use |

## 8a. External addresses: the one-URL convention and where it is not followed yet

Converted in this change: `CEVOC_SCRAPER_EVIDENCE_BASE_URL` became `CEVOC_SCRAPER_EVIDENCE_URL` (full login page address, old name retired, no fallback). Host-only values are still completed with the built-in path by the Playwright session (`PlaywrightSession.loginUrl`), so an unchanged GitHub variable that holds only the origin keeps working; set it to the full address and that completion can then be removed. Left unchanged on purpose (behaviour is not changed here), with the proposed fully qualified form:

| Today | Built from pieces / relative because | Proposed single setting |
|---|---|---|
| `CEVOC_REVENUE_NSW_HTTP_BASE_URL` + `_PATH_PREFIX` (code adds `/rest/api/v2/fines` and call paths) | host plus a constant segment, then fixed paths | `CEVOC_REVENUE_NSW_HTTP_URL` = the full service root up to and including `/fines`; the call paths below it are the code's own request parts |
| Blob storage address: `AZURE_STORAGE_CONNECTION_STRING` (account) plus `CEVOC_MEDIA_AZURE_CONTAINER` | account address and container name are separate | `CEVOC_MEDIA_AZURE_CONTAINER_URL` = the full container address (needs a credential setting beside it) |
| `CEVOC_CORS_ALLOWED_ORIGINS` | origins only (scheme, host, port), comma list; an origin is not a path | already fully qualified per entry; no change |
| Backend address the front end calls: GitHub variable `CEVOC_API_BASE_URL` feeding `VITE_API_BASE_URL`, code appends `/api/...` and `/live-check/...` | base plus request paths added by the front end | keep the base: the front end adds its own request paths, which is the allowed exception |
| `CEVOC_MEDIA_PUBLIC_BASE_URL` (prefix for `/api/media/<token>` links; empty means relative links across hosts) | prefix plus token path added by code; relative when empty, which breaks across hosts | `CEVOC_MEDIA_PUBLIC_URL` = the full address of the media endpoint (`https://<backend>/api/media`), and refuse relative links |
| `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` | already one full URL; built-in default `https://cevoc.transport.nsw.gov.au/cevoc/pages/sdro/searchCertificates.jsf` | already fully qualified; only the built-in default would move out of code |
| `CEVOC_DEMO_BUNDLE_URL` | already one full https URL | already fully qualified |
| `CEVOC_MEDIA_BASE_URL` (stub sample location, `/samples`) | relative path, same host as the page | `CEVOC_MEDIA_SAMPLES_URL` = a full URL when the samples live on another host |

## 9. GitHub variables and secrets used by workflows (names only; not container settings)

| Name | Kind | Used by | Notes |
|---|---|---|---|
| `LIVE_CHECK_ENABLED` | variable | backend deploy workflow | Exactly `true` switches the deploy into live mode. Default off. |
| `CEVOC_BASE_URL` | variable | backend deploy workflow (live mode) | Becomes `CEVOC_SCRAPER_EVIDENCE_URL` on live deploys. The workflow also sets `CEVOC_EVIDENCE_PROVIDERS=http,browser`. Must be https; give the full login page address (or leave it unset only if the workflow is changed to skip it; the code default is the same address). |
| `LIVE_CONTACT` | variable | backend deploy workflow (live mode) | Becomes `CEVOC_SCRAPER_EVIDENCE_CONTACT`. |
| `LIVE_CASES` | secret | live-check run workflow | JSON list of cases; printed only as redacted summaries. |
| `LIVE_CHECK_TOKEN` | secret | nothing | **Retired.** No workflow reads it; delete it. |
| `CEVOC_API_BASE_URL` | variable | static web app workflow | Feeds `VITE_API_BASE_URL`. |
| `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_SUBSCRIPTION_ID`, `AZURE_LOG_WORKSPACE_ID` | secrets in environment `log-query` | log query workflow | Read-only log reader; see section 9a. |

The demo flag is deliberately NOT set in any workflow, including the deploy workflow: the owner sets `CEVOC_DEMO_DATA_ENABLED` in the Azure portal.

## 9a. Log query workflow (owner-run, read-only)

`.github/workflows/log-query.yml` ("Log query") reads the Container App's console logs from its Log Analytics workspace and prints a redacted summary on the run page, so a failing certificates step can be read without the Azure portal. It runs only when started by hand (Actions, Log query, Run workflow); there is no schedule. It uses `az login --service-principal` and `az monitor log-analytics query`, and nothing else in Azure. Output goes to the run's step summary only: no artifacts, and raw query output is never printed to the job log.

**Secrets the owner creates.** Create them as secrets of a GitHub environment named `log-query` (Settings, Environments, New environment, then add the secrets there). Environment secrets take priority over repository secrets of the same name, so the existing `AZURE_CLIENT_ID`, `AZURE_TENANT_ID` and `AZURE_SUBSCRIPTION_ID` that the deploy workflows use are left alone. Do NOT overwrite those repository-level secrets with the log reader's values.

| Secret | What it is |
|---|---|
| `AZURE_TENANT_ID` | Microsoft Entra tenant (directory) ID of the service principal. |
| `AZURE_CLIENT_ID` | Application (client) ID of a service principal made only for reading logs. |
| `AZURE_CLIENT_SECRET` | A client secret for that service principal. Give it the shortest expiry that suits. |
| `AZURE_SUBSCRIPTION_ID` | Subscription that holds the workspace. |
| `AZURE_LOG_WORKSPACE_ID` | The Log Analytics workspace ID (the workspace's customer ID GUID, shown on the workspace Overview page). Not the resource group and not the full resource ID. |

**Permission.** Assign the service principal the built-in `Log Analytics Reader` role on the workspace and no other role. That role cannot change anything. The workflow itself has only `contents: read` on the repository and never checks out code.

**Queries (fixed list, no free text).**

| Choice | What it prints |
|---|---|
| `certificate-step-last-24h` | Counts of error, warning and info lines for certificate log lines in the last 24 hours, then the last 20 such lines (timestamp, level, message). |
| `step-trace-last-hour` | Step trace lines (steps 1 to 8: lines naming a step number or `step=`, the lookup service and the certificates step) from the last hour, newest 100, oldest first. |
| `app-health` | Per revision: replica count, log line count, last log time and last start-up time (last hour); restart events from the system log table; and the last non-certificate error, shown as exception class and logger only (the message text is not shown). |
| `certificate-403-detail` | Certificate failures in the last 6 hours: counts by cause, then the newest 50 lines with cause token, provider id, HTTP status, duration and the server header if a line carries one, plus the message. |

**Redaction.** Applied inside the query (so unredacted text never leaves Azure) and again when the summary is written: any run of 7 or more digits (covers 10-digit notice numbers), plate-shaped text (2 or 3 letters then 2 to 4 digits, optional trailing letters, such as `AB12CD` or `ABC 123`), values after name-like keys (`name`, `owner`, `driver` and similar) and e-mail addresses. Free-text personal names cannot be found by pattern, so the safe-vocabulary log lines (see section 4) are the main protection; the redaction is a second layer. It can over-redact short letter-digit text, which is deliberate.

Limits: the step trace is only as complete as what the application logs to the console; restart and start-up figures are read from log text and system event reasons, so treat them as indicators. If the system log table is not collected in the workspace, that part of `app-health` says the query failed.

## 10. Which names the deploy workflow manages (who sets what)

`.github/workflows/cevoc-backend-AutoDeployTrigger-*.yml` runs `az containerapp update --set-env-vars` on every deploy (PROVEN from the workflow text).

- **Every non-live deploy sets none of the `CEVOC_*` names** (record 0021). The owner sets these on the container app if they want something other than the default, and a normal deploy leaves them exactly as they are, never blanking them (only `CEVOC_SCRAPER_EVIDENCE_CONTACT` is required): `CEVOC_PENALTY_LOOKUP_ADAPTER`, `CEVOC_CERTIFICATES_PROVIDERS`, `CEVOC_SCRAPER_EVIDENCE_URL`, `CEVOC_SCRAPER_EVIDENCE_CONTACT`, `CEVOC_BANNER_OCR_ENABLED`, `CEVOC_LIVECHECK_ENABLED`, `CEVOC_DEMO_DATA_ENABLED`, `CEVOC_CERTIFICATES_SEARCH_PAGE_URL`. A name never set stays unset, so the code default applies (adapter `browser`, certificate provider `browser`, built-in addresses, live check, OCR and demo data off). It sets the image and one replica and does NOT set CPU or memory: the owner sets 2 CPU / 4Gi once in the Azure portal (Chromium needs it) and a normal deploy leaves it. Its post-deploy check is `GET /api/ping` (answers `ok`, touches no adapter or network), never `POST /api/penalty-lookups`.
- **Every live deploy (`LIVE_CHECK_ENABLED` = `true`) sets, and so overwrites any portal value for:** `CEVOC_EVIDENCE_PROVIDERS=http,browser` (the adaptive circuit-breaker adapter), `CEVOC_LIVECHECK_ENABLED=true`, `CEVOC_SCRAPER_EVIDENCE_URL` and `CEVOC_SCRAPER_EVIDENCE_CONTACT` from the GitHub variables, `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` (explicit), `CEVOC_CERTIFICATES_PROVIDERS=curl,http,browser`. It removes `CEVOC_BANNER_OCR_ENABLED` (no longer read). It raises CPU / memory to 2 / 4Gi only if the app is currently smaller; it never shrinks it. Its post-deploy check is `/live-check/ping`.
- **Never touched by the workflow, so old values stay in the portal until the owner deletes them:** every REMOVED name in this document. They are read by nothing, so leaving them is harmless, but delete them.
- **Not touched by the workflow, so portal edits stick:** `CEVOC_DEMO_DATA_ENABLED` (and every other name the non-live bullet lists), `CEVOC_DEMO_BUNDLE_*`, `CEVOC_CORS_ALLOWED_ORIGINS`, `CEVOC_MEDIA_*`, `CEVOC_REVENUE_NSW_HTTP_*`, `CEVOC_BANNER_OCR_COMMAND`, `CEVOC_CERTIFICATES_APPROVAL_REFERENCE` and the other tuning keys.

## 11. Dead and removed names: safe to delete in the Azure portal

Nothing in the code, workflows, Dockerfile or scripts reads these:

- Removed by record 0020: `CEVOC_SCRAPER_ENABLED`, `CEVOC_SCRAPER_EVIDENCE_ENABLED`, `CEVOC_SCRAPER_CERTIFICATES_ENABLED`, `CEVOC_SCRAPER_CERTIFICATES_APPROVAL_REFERENCE`, `CEVOC_SCRAPER_EVIDENCE_BROWSER`, `CEVOC_SCRAPER_EVIDENCE_BASE_URL`, `CEVOC_LIVECHECK_TOKEN`, `CEVOC_REVENUE_NSW_HTTP_ENABLED`.
- Stale hand-added names: `CEVOC_EVIDENCE_SCRAPER_ENABLED`, `CEVOC_CERTIFICATE_SCRAPER_ENABLED`.
- Retired earlier: `CEVOC_DEMO_DATA`.
- Removed by record 0022: `CEVOC_CERTIFICATES_APPROVAL_REFERENCE`.

The portal itself was not inspected: any `CEVOC_` name in the portal that is not in this document is also read by nothing.

## 12. Owner opinions: status

All implemented by record 0020 except the items below.

1. Scraper flags removed (`CEVOC_SCRAPER_ENABLED`, `CEVOC_SCRAPER_EVIDENCE_ENABLED`, `CEVOC_SCRAPER_CERTIFICATES_ENABLED`): DONE. The adapter value is the only switch. A `browser` selection without URL or contact answers "switched off" (it does not stop start-up).
2. Live-check token removed: DONE. `CEVOC_LIVECHECK_ENABLED` is kept; a later decision may still delete the whole live-check feature.
3. `CEVOC_SCRAPER_EVIDENCE_BROWSER` removed: DONE. Headless stays a separate setting (`CEVOC_SCRAPER_EVIDENCE_BROWSER_HEADLESS`).
4. One fully qualified URL per external address: DONE for the evidence address, listed with proposals for the rest in section 8a.
5. `CEVOC_MEDIA_PUBLIC_BASE_URL` and `CEVOC_CERTIFICATES_SEARCH_PAGE_URL`: unchanged, see section 8a.

## 13. Next steps for the owner (Azure Container App environment variables, names only)

Record 0022: the defaults are the real adapters, so the container app needs only one variable. A normal deploy leaves whatever is there untouched (record 0021); a live-mode deploy still sets its own values.

- **KEEP / ADD (required):** `CEVOC_SCRAPER_EVIDENCE_CONTACT`.
- **KEEP only if wanted:** `CEVOC_DEMO_DATA_ENABLED` (demonstration environments only), the demo, CORS and media settings if you use them.
- **DELETE (defaults now do the same):** `CEVOC_PENALTY_LOOKUP_ADAPTER` and `CEVOC_CERTIFICATES_PROVIDERS` if they hold `browser`; `CEVOC_SCRAPER_EVIDENCE_URL` if it holds the Revenue NSW login page; `CEVOC_CERTIFICATES_SEARCH_PAGE_URL` if it holds the default; `CEVOC_LIVECHECK_ENABLED` unless a live check is running; `CEVOC_CERTIFICATES_APPROVAL_REFERENCE`.
- **CAUTION:** if `CEVOC_PENALTY_LOOKUP_ADAPTER` holds `stub`, `manifest` or `scraper-evidence`, the app stays on `stub` (fictitious data, nothing contacted) until the variable is deleted or set to `browser`. If `CEVOC_CERTIFICATES_PROVIDERS` holds `search-page` (retired name), it is ignored and no certificate source exists until the variable is deleted or set to `browser`.
- **DELETE (read by nothing):** `CEVOC_SCRAPER_ENABLED`, `CEVOC_SCRAPER_EVIDENCE_ENABLED`, `CEVOC_SCRAPER_CERTIFICATES_ENABLED`, `CEVOC_SCRAPER_EVIDENCE_BROWSER`, `CEVOC_SCRAPER_EVIDENCE_BASE_URL`, `CEVOC_LIVECHECK_TOKEN`, and if present `CEVOC_SCRAPER_CERTIFICATES_APPROVAL_REFERENCE`, `CEVOC_REVENUE_NSW_HTTP_ENABLED`, `CEVOC_EVIDENCE_SCRAPER_ENABLED`, `CEVOC_CERTIFICATE_SCRAPER_ENABLED`, `CEVOC_DEMO_DATA`. Also delete the GitHub secret `LIVE_CHECK_TOKEN`.
- **Size:** Chromium needs about 2 CPU / 4 GiB. Set it once in the portal; no normal deploy changes it and a live deploy only raises a smaller app (record 0021). Do that before setting the contact on a smaller app.

## 14. Shared settings file (`settings.json`)

`settings.json` at the repo root holds version-controlled defaults shared by the frontend and the backend. It is not for secrets or per-environment overrides (those stay as environment variables). It is for values that are the same in every environment, change rarely, and were previously hardcoded in source files.

**How each side reads it:**

- **Frontend (Vite):** imported as a JSON module (`import settings from '../../settings.json'`). Vite bundles it at build time.
- **Backend (Spring Boot):** the settings file documents the authoritative default values. The backend continues to read its own Spring properties (with the same defaults), so the file is the single place to check what the intended default is. A `SettingsLoader` can be added later if the backend should read the file directly at start-up.

**Current keys:**

| Key | Type | Default | Where used | Notes |
|---|---|---|---|---|
| `maxOffenceAgeYears` | integer | `7` | `frontend/src/lookupValidation.js` | How far back an offence date is accepted |
| `certificates.intraDelayMaxMs` | integer | `1000` | `CertificateProviders.java` | Max random delay (ms) between GET and POST in a certificate lookup |
| `certificates.cacheTtlSeconds` | integer | `300` | `CertificateProviders.java` | Certificate cache TTL; overridable via `CEVOC_CERTIFICATES_CACHE_TTL_SECONDS` |
| `certificates.curl.timeoutSeconds` | integer | `10` | `CertificateProviders.java` | Curl connect/total timeout; overridable via `CEVOC_CERTIFICATES_CURL_TIMEOUT_SECONDS` |

**Candidates for future externalization** (listed in `settings.json` under `_candidates`): SSE heartbeat interval, max images per lookup, max detail fields, max evidence cache entries, host reachability timeout, notice number length, registration max length.
