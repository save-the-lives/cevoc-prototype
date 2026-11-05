# Architecture (standing document)

This is the one place where anything architectural is captured. It is organised by area. Each area states the current position and points at the decision records in `docs/decisions/` (what was chosen, why, what was ruled out, date, owner approval). Any architectural decision made in voice or text is added here and as a record in `docs/decisions/`. Detailed implementation notes from before this document was reorganised are kept unchanged further down, under "Detailed implementation notes".

Contributor note: this is a public repository. Describe people only as "owner" or "project owner" (and "owner approval" in decision records). Do not name anyone's employer or role, and do not name individuals. Naming organisations as data sources or providers (Revenue NSW, the TfNSW certificates page) is fine and needed.

Status words used below: PROVEN means checked in the code or a run; INFERRED means reasoned but not checked; PROPOSED means designed, awaiting an owner pick, not built.

## Areas and decisions

| Area | Position today | Decision records |
|---|---|---|
| Structure | Hexagonal: domain, application (ports), adapters; `ArchitectureTest` enforces direction | 0001 |
| Cloud and vendors | Cloud-agnostic. Azure is the MVP trial only. AWS is the real target. Vendor specifics live behind adapters and in deploy config only | 0002, 0008 |
| Providers (sources of data) | Revenue NSW is the interim provider. TfNSW APIs replace it concern by concern, by configuration | 0003 |
| Browser (Chromium) route | Prototype only, behind its adapter, deleted at cutover | 0004 |
| Plain HTTP route (Revenue NSW JSON service) | BUILT 2026-11-05, offline-tested, NOT yet run live (UNTESTED). Selected by `cevoc.penalty-lookup.adapter=revenue-nsw-http`; off unless also enabled; default unchanged | 0010 |
| Data scope and security | Public data only. No secrets in code, logs or the hand-off log | 0005 |
| Published URLs | Existing prototype URLs must not change | 0006 |
| Information types, status and per-program switches | PROPOSED, not built: images, certificates, video (placeholder) with a status per item. Decided 2026-11-04: per-program switches live in a plain config file in the repo with date-ranged versions chosen by offence date. Program lookup recommended, awaiting owner answers | 0007 |
| Vendor-neutrality drift | Audit of 2026-11-04: no core leak into domain or application cloud-wise; a few leaks listed in record 0008 | 0008 |
| Privacy blurring of evidence video and images | PROPOSED, research only: fail closed, server-side burn-in, detect once into a timed region track and merge into one stream, verify by content, never release on failure. Paper: `docs/research/privacy-blurring.md` | 0017 |

## Three selectable routes for notice details and images (record 0010)
The lookup port (`PenaltyLookupPort`) has three kinds of route, chosen by configuration. The default (`manifest`) is unchanged and the Chromium route is unchanged.

| Route | Select with `cevoc.penalty-lookup.adapter` | Also needed | Package | Status |
|---|---|---|---|---|
| Manifest / stub (default) | `manifest` (default), `stub` | nothing | `adapter.out` | PROVEN |
| Chromium scraper (prototype only) | `scraper-evidence` | `cevoc.scraper.enabled=true`, `cevoc.scraper.evidence.*`, the `live-browser` build, Chromium in the image | `adapter.out.scraper` | PROVEN (live runs 2026-11-03/04) |
| Plain HTTP, Revenue NSW JSON service (interim) | `revenue-nsw-http` | `cevoc.revenue-nsw-http.enabled=true`, `base-url` (https, host `api.osr.nsw.gov.au` unless `allowed-hosts` says otherwise), `path-prefix`, `contact`, `approval-reference` | `adapter.out.revenuensw` | BUILT, UNTESTED live |
| API providers (TfNSW or others) | reserved | an agreed API, credentials, owner approval | n/a | reserved |

Plain HTTP route, as built (env names: `CEVOC_REVENUE_NSW_HTTP_<NAME>`):
- Flow: token call (notice number in the `pnnum` header, JSON body `offenceDate`) -> summary call -> only when a registration is supplied for this request: second token call (body adds `vehicleRego`) -> one `GET .../images/{id}?size=full` per identifier. The newest `authorization` response header is always the one sent next. Not made: the `services` and `notifications` calls (the summary already carries the notifications; "plate required" is read as images present and no registration given).
- Safety: every call waits the polite gap (`min-interval-ms`, default 1000, floor 500) and has connect and request timeouts; the identifying User-Agent carries the contact; no `origin`, `referer` or cookie is sent (no browser disguise); 401, 403, 429 and a captcha page stop the lookup with that cause token and are never retried; only a summary timeout is retried (`summary-retries`, default 1, at most 2); the registration goes only in the body of the images token call and never into logs, trace, diagnostics, keys, details or the cache (there is no result cache on this route); only https on an allow-listed host is accepted; image identifiers are checked before they enter a path.
- Result: the same canonical `PenaltyLookupResult` (typed `NoticeDetails` from `offence.*` and `payment.outstanding.amount`; every other summary field, except identifiers and the signed certification link, flows to `details` as lower camel keys such as `demeritPoints`, `imageCount`, `seriousOffence`); the camera code is the `s` query value of `images.cameraCertification.ref` (the signed value is never read), so the certificate providers work as before; image bytes go through `MediaStoragePort` (the in-memory media adapter is chosen by default for this route, like the Chromium route), `capturePath` is `RESPONSE`.
- By-design versus technical (record 0007): no match, officer-issued (no images), plate required, plate not accepted are normal outcomes (`NOT_FOUND`, `FOUND` with a note); timeout, network error, server fault, bad shape, refusals and captcha are `UNAVAILABLE` with a whitelisted cause token (`timeout`, `network-error`, `source-failed`, `bad-shape`, `blocked-401|403|429`, `captcha`). Browser-only steps (`start-browser`, `open-login`) report `not-supported`.
- Certificates with this route: list `search-page-http` (no browser) in `cevoc.certificates.providers`; `search-page` needs the browser.
- Not built: `cevoc.providers.<concern>` lists (the single adapter switch above is used; the certificates list already exists), thumbnail and medium sizes (only `full` is stored; the media endpoint makes the smaller copies as for the Chromium route), a result cache.

## Information types, status and transparency (PROPOSED, record 0007)
Types: `IMAGES`, `CERTIFICATES`, `VIDEO` (placeholder only; the legacy site has no video, so nothing is built or wired for it). Each type has its own outbound port and its own providers; the domain holds a provider-agnostic section per type carrying a status and a message, and the UI renders only the status and message. Statuses: `AVAILABLE`, `OFF_BY_CHOICE`, `NOT_APPLICABLE` (this program does not have this type), `NOT_YET_AVAILABLE` (by design, planned, such as video today) and `FAILED` (expected but could not be retrieved for a technical reason). The rule: a type is never hidden silently. A by-design message ("Video is not available for this offence") must read differently from a fault message ("We could not load the video just now. This is a fault, not a choice. Try again later").

## Per-program capability configuration (record 0007; source and versions DECIDED 2026-11-04, not built)
- Simple on purpose. Each enforcement program decides what is on or off and this rarely changes. The configuration is a plain YAML or JSON file in the repository: no database, no admin screen, no feature-flag service. Git is the version history; changing a switch is edit, review, redeploy. An optional `version` label names each rule set. Every switch change is noted in a decision record.
- Date-ranged versions. Each program holds a list of versions with a start date and an optional end date (the current one has none). The app picks the version that covers the OFFENCE DATE of the notice. At load time the file is checked and the backend refuses to start on an overlap, a gap, a start after an end, or more than one open-ended version. If no version covers the offence date, each type section shows a plain not-available message (transparency rule, never hidden). A test lists the program and version chosen for sample dates.
- Program lookup (PROPOSED). A notice must be matched to a program before any switch applies, and the repo has no table for that. Recommended: a small mapping in the same file, tried by offence code (or normalised offence text while no code is exposed), then camera code, then location text, then a default block with a visible message; behind a port so TfNSW APIs can supply the program later.

What the code returns today (as read on 2026-11-04):
- PROVEN: the penalty page parser returns offence description text, offence date and time, free-text location, amounts, status and a derived enforcement method (`CAMERA`, `OFFICER_ISSUED`, `UNKNOWN`). It returns no offence code or type. It returns the camera code (fictitious 7109) only in the images state, after the registration step.
- PROVEN: the image banner parser reads an "Offence" text, lane, direction and more, but only the camera code is kept.
- PROVEN: the certificates page returns description, type, period and dates only; it is queried by camera code as location code and returns no program information.
- PROVEN: no camera-code-to-program table exists; `EnforcementSiteResolver` (location text to certificate location code) is a stub that is not wired in. No code or fixture mentions bus lane or mobile phone detection.
- INFERRED: the real penalty page may show an offence code that the fictitious fixtures do not model.
Open questions on all of this are listed in record 0007.

## Contributor and process rules
- Docs-only changes are raised on their own branch. This document and the records are updated in the same change as the decision.
- Nothing in this repository may describe the owner or contributors by employer or role.

---

# Detailed implementation notes (kept from before the reorganisation)

Hexagonal. Dependencies point inwards: `adapter` -> `application` -> `domain`. `ArchitectureTest` enforces this.

    backend/src/main/java/cevoc
      domain/                 records only, no framework
      application/port/in/    LookupPenaltyUseCase   (what the outside can ask)
      application/port/out/   PenaltyLookupPort      (how we get content)
                              MediaStoragePort, SignedLinkPort, CacheInvalidationPort (media, cloud-neutral)
      application/service/    LookupPenaltyService
      adapter/in/web/         REST controller (public, unauthenticated)
      adapter/out/            ManifestPenaltyLookupAdapter (resources/manifest.json), ManifestFirstPenaltyLookupAdapter (manifest, then live if enabled)
      adapter/out/stub/       StubPenaltyLookupAdapter (fictitious data), StubMediaAdapter (sample-file links)
      adapter/out/azureblob/  Azure Blob adapter (SAS links); the only place com.azure is allowed (plus config)
      adapter/out/s3/         placeholder only: where the AWS adapter will go
      config/                 BeanConfig: the only place that chooses an adapter

## Media (evidence images, video, certificates)
The backend never proxies media bytes. It only returns short-lived links; the browser fetches from storage/CDN.
- `MediaStoragePort`: store/locate objects by key. `SignedLinkPort`: short-lived, unguessable, read-only link. `CacheInvalidationPort`: purge CDN/cache for a key.
- A `PenaltyLookupPort` adapter returns evidence items carrying an object key; `LookupPenaltyService` turns each into a link via `SignedLinkPort` (5 minute validity).
- Select with `cevoc.media.adapter`:
  - `stub` (default): links are `cevoc.media.base-url` (default `/samples`) + key. No cloud account needed.
  - `azure-blob`: read-only SAS URLs. Needs `cevoc.media.azure.connection-string` (use `AZURE_STORAGE_CONNECTION_STRING`; keep it out of git) and optional `cevoc.media.azure.container` (default `evidence`). Upload the sample objects (`image-1.jpg`, `video-1.mp4`, `cert-1.pdf`) to the container to try it.
- `ArchitectureTest` forbids cloud SDKs (`com.azure`, `software.amazon`, ...) in `domain` and `application`, and stops the azure and s3 adapter packages depending on each other.

### Adding an S3 / CloudFront adapter
1. Add the AWS SDK v2 dependencies (`s3`, optionally `cloudfront`) to `pom.xml`.
2. Create `adapter/out/s3/` with: `S3MediaStorageAdapter` (MediaStoragePort), `CloudFrontSignedLinkAdapter` (SignedLinkPort, CloudFront signed URLs with a key pair, or `S3Presigner` for plain S3), `CloudFrontInvalidationAdapter` (CacheInvalidationPort, `CreateInvalidation`).
3. In `BeanConfig` add beans conditional on `cevoc.media.adapter=s3`, with its own properties (bucket, distribution domain, key pair id, private key from a secret store).
4. Do not touch `domain` or `application`; `ArchitectureTest` will fail if AWS types leak in.

## Swapping sources later
Select with `cevoc.penalty-lookup.adapter`: `manifest` (default; manifest first, then the live source only if `cevoc.scraper.enabled=true`, else status `LIVE_LOOKUP_DISABLED`) or `stub`. Env: `CEVOC_PENALTY_LOOKUP_ADAPTER`, `CEVOC_SCRAPER_ENABLED` (default false). No live adapter is wired yet, so enabling it reports UNAVAILABLE. Planned adapters, none built yet:
- `revenue-nsw`: pass the notice number and offence date to the public Revenue NSW / Service NSW page and extract the returned content.
- `evidence-api`: real image, video and certificate APIs, with caching or buffering.

## Certificate scraper (inert by default, owner approval required)
`CertificateSourcePort` (application/port/out) returns `CertificateRef`s for a `CertificateQuery`. The only adapter, `adapter/out/scraper`, reads the enforcement-centre certificates JSF page. It is wired into the lookup flow only as described under "Certificates in the lookup response", and is never a default.
- Off unless `cevoc.scraper.certificates.enabled=true` (env `CEVOC_SCRAPER_CERTIFICATES_ENABLED`, default false). When enabled, `cevoc.scraper.certificates.approval-reference` (the owner's approval reference) is also required or startup fails.
- Polite: identifying User-Agent (`...user-agent`), min 5 s between requests (`...min-interval-ms`, floor 2000), connect/request timeouts, one request at a time, no retries, cache of at most 10 minutes (`...cache-ttl-seconds`, default 300).
- `CertificatePageParser` is the only class that knows the HTML and JSF ViewState handling. Tests use fictitious fixtures in `src/test/resources/scraper/certificates`, never live calls.
- Key strategy `cevoc.scraper.certificates.key-strategy`: `VIA_ENFORCEMENT_SITE` (default; RESOLVED, matches the real page) or `BY_PENALTY` (NOT supported by the real page; fictitious fixtures only). The real page "Customer Enquiry and Verification of Certificate" (`searchCertificates.jsf`) is keyed by mandatory `Location code`, `Date/Time from` and `Date/Time to` (dd/MM/yyyy HH:mm; "to" is pre-filled with now), with buttons SEARCH, CLEAR, CLOSE. It has no penalty number field, so the flow is penalty lookup -> `NoticeDetails.location` + offence date/time -> `EnforcementSiteResolver` -> location code -> certificates valid in the window.
- `CertificateQuery` carries `locationCode` + `from`/`to` (minute precision). The window is the whole offence day (00:00 to 23:59) by default; `cevoc.scraper.certificates.window-margin-minutes` (unset by default) narrows it to offence time +/- N minutes (0 to 1440). `CertificateScraperProperties.queryFor(...)` builds it.
- `EnforcementSiteResolver` (application/port/out) takes the lookup result's `NoticeDetails` and returns an optional location code. Only stub implementation: `ManifestEnforcementSiteResolver`, which maps the notice `location` text (case and spacing ignored) to the optional `locationCode` in `manifest.json` (fictitious codes such as `TEST-LOC-01`). It is not wired into the lookup flow. UNCONFIRMED: whether the penalty page exposes a real location code or only a descriptive place name. If only a name, the owner must supply a maintained name-to-code table.

### What is resolved and what is still unknown
- Resolved: the certificates page is keyed by location code plus date range, not penalty number.
- Resolved (results shape, from the owner): the results table has columns Certificate Description, Certificate type, Period, Certified date, Expiry date, and no visible download link. The deep link `certificateDetails.jsf` carries a signed `m` parameter, so links are never constructed; `CertificateRef.documentRef` holds only an href actually present in the row (usually null). The parser matches columns by header text and tolerates dd/MM/yyyy with an optional time. The evidence banner's camera code IS the certificates Location code and is passed straight to `CertificateScraperProperties.queryFor(...)`.
- Covering certificate: `CertificateRef.covers(offenceAt)` is true when the Period window (inclusive; a date-only end means end of that day) contains the offence date/time; an unparseable Period never covers. `CertificateSourcePort.findCertificatesCovering(query, offenceAt)` returns the full list as `CertificateMatch` rows with the covering one(s) marked, nothing dropped, so a caller can show the choice when several or none match. A page with neither a results table nor a no-results marker throws `ScrapeException` instead of returning an empty list.
- Still unknown: the real JSF field ids (form, location code, date from, date to, SEARCH button), which remain guesses isolated as constants in `CertificatePageParser`; the exact Period text format and "no results" message; any captcha or login. Tests use fictitious fixtures only.
- Production use still needs the owner's approval (robots.txt disallows automated access); the adapter stays off by default and keeps the approval-reference, polite rate limit and no-live-calls-in-tests safeguards. No real location codes or notice numbers belong in the repo.

- robots.txt disallows automated access. Production use needs the owner's approval, and this adapter should be replaced by the real certificate API.

## Certificate providers (search page is interim)
**PROTOTYPE-ONLY: the browser option.** The Chromium route (provider `search-page`, the legacy `browser-link`, the Playwright session in `src/live`, the `live-browser` Maven profile, the live-check endpoints and the Chromium layers of the Docker image) exists only for this prototype. Production uses the API providers. At cutover DELETE: `backend/src/live/` (PlaywrightSession, PlaywrightSessionFactory, NetworkMap*, HtmlCapture, LiveCheckController), the `live-browser` profile and `build-helper` entry in `pom.xml`, `RenderedPageSession`/`RenderedPageSessionFactory` and the scraper evidence adapter, `SearchPageCertificateSource`, `BrowserCertificateSourceAdapter`, `CertificateHandoff`, the `livecheck` package and guard, `.github/workflows/live-check-run.yml`, the live-check parts of the deploy workflow, `scripts/live-check.sh`, and Chromium from `backend/Dockerfile`. Nothing in production code may depend on them; the app logs a prototype-only warning at start-up when a browser provider is active.

Since 2026-11-04 certificates come through an ordered provider list, `cevoc.certificates.providers` (default empty = none): `search-page` (the public search page in a headless browser; interim, owner-approved despite robots.txt, replaced by `tfnsw-api` by config), `tfnsw-api` (reserved), `http-form` and `browser-link` (legacy; the signed deep link answers 403 and is no longer followed unless `browser-link` is listed). All implement `CertificateSourcePort`, share the fictitious-fixture contract tests and the canonical shape in docs/DIRECT-API-ROUTE.md, and need `cevoc.certificates.approval-reference`. The sections below describing the deep link and the HTTP form describe the legacy providers.

## Certificates in the lookup response
`LookupPenaltyService` (application layer) adds a `certificates` list to the lookup result. After the evidence lookup yields an internal camera code, it calls `CertificateSourcePort.findCertificatesCovering(query, offenceAt)` with `locationCode = cameraCode` and a window from `CertificateQuery.aroundOffence` (whole offence day, or offence time +/- `cevoc.scraper.certificates.window-margin-minutes`). The whole list is returned, in page order, with `coversOffence` true on the row(s) whose Period contains the offence date/time.
- JSON: `certificates: [{description, type, periodText, certifiedDate, expiryDate, coversOffence}]`, dates as `yyyy-MM-dd` strings. The camera code, plate and links are never in the response (`cameraCode` stays `@JsonIgnore`). The existing certificate evidence item is unchanged.
- Adapters that already carry certificates are left as they are: the manifest adapter maps optional `certificates` rows in `manifest.json` (fictitious; `periodFrom`/`periodTo` decide the covering row) into the same shape.
- No camera code, or the certificate port disabled (scraper off, the default): empty list, no query. A certificate failure never fails the lookup: it degrades to an empty list with an internal `certificatesNote` (not serialised).

### Browser route for certificates (same Chromium session)
After the images state, `ScraperEvidenceLookupAdapter` calls `RenderedPageSession.openCertification()`, which clicks the page's "View certification details" link inside the same browser session (the signed `m` value never leaves the browser; no URL is built or logged). The rendered certificates page is handed over via `CertificateHandoff` (thread-local, consumed once, cleared at the start of each lookup) to `BrowserCertificateSourceAdapter`, a `CertificateSourcePort` that only parses (`CertificatePageParser.parseRendered`: results table, else label/value layout). `LookupPenaltyService` is unchanged: it calls `findCertificatesCovering(query, offenceAt)` as before. The bean exists only when `cevoc.scraper.evidence.browser=playwright` and `cevoc.scraper.evidence.enabled=true` and the HTTP certificate scraper is not enabled. Top-level navigation may leave the myPenalty host only for `*.transport.nsw.gov.au`. A failure never fails the lookup (empty list, "Certificates unavailable"). Live-check diagnostics for this step are structure only: `step=certificates; outcome=ok|failed|skipped; cause=<token>`, then counts, header labels from a fixed vocabulary and yes/no markers (`cert-*`), never values or page text.

## Scraper adapter (prototype only, off by default)
`adapter/out/scraper/` can read a Revenue NSW style penalty page and copy its images and videos into storage through `MediaStoragePort`, returning object keys like any other `PenaltyLookupPort`.

**Production use needs the site owner's (Revenue NSW / Service NSW) written approval first. It should be replaced by the real evidence API.** The project owner obtains that approval before it is ever enabled. Until then it must stay off.

Safeguards:
- Never the default. `stub` stays the default in code, tests and every shipped config. It runs only if `cevoc.penalty-lookup.adapter=scraper-evidence` AND `cevoc.scraper.evidence.enabled=true` (env `CEVOC_SCRAPER_EVIDENCE_ENABLED`, default `false`). It also needs `cevoc.scraper.evidence.base-url` (https) and `cevoc.scraper.evidence.contact`; with any of these missing it returns `LIVE_LOOKUP_OFF` and makes no network call.
- Polite: identifying User-Agent (`cevoc-prototype/1.0 (contact: ...)`), minimum 5 s between requests (`min-interval-ms`), connect and request timeouts, size cap (`max-bytes`), strictly sequential (no parallelism), images only from the browser session's own blob: handles, 2 minute result cache (`cache-ttl-seconds`, notice details only; never results with images). The pacing, timeout and size settings are for the future browser adapter to honour.
- Isolation: all HTML knowledge lives in `RevenueNswPageParser`; a site change should break only that class and its fixture.
- Tests (`ScraperEvidenceTest`) use saved fictitious DOM in `backend/src/test/resources/fixtures/scraper/` and a fake `RenderedPageSession`. No live network, no real notice numbers or personal data.

### Three-state myPenalty flow (building only; still off)
Source: the owner's description of the real flow (no live request has ever been made; all fixtures are FICTITIOUS: notice 9000000004, plate TST123, camera code 7109, incident 6).
1. Login (Angular app, base href `/customer_service/finesonline/`): inputs `pnn` and `dateOfOffence` (DD/MM/YYYY), a Next button; hidden, disabled `lastName`, `firstName`, `organisation` exist for some notice types (if one is enabled, the notice type is out of scope and the lookup is UNAVAILABLE).
2. Summary: heading "Penalty Notice Number - n", a paid/owing notification box, rows "Date of offence:", "Offence Time:", "Offence Description:", "Demerit Points:", "Penalty Amount:", "Location:" (free text, not a code). The Images section is a separate form with one field `vehicleNumber` ("Registration number:") and a "View images" button; "Registration number is required" shows when empty. No "Registration number:" row yet.
3. Images: the plate form is replaced by the images section; a "Registration number:" row appears; a large image plus thumbnails, each with a ref like `700-1-<digits>`; "Download Images"; "Camera Certification" with a "View certification details" link to `certificateDetails.jsf` (query p notice, d offence date-time, s camera code, i incident number, m signed value).

Because the site is Angular, a plain HTTP fetch returns an empty shell, so the adapter talks to a small port, `RenderedPageSession` (+ `RenderedPageSessionFactory`): `loginPage()`, `submitLogin(notice, DD/MM/YYYY)`, `submitPlate(plate)` each return the rendered DOM, and `imageBytes(blobUrl)` returns image bytes from the SAME session (images are `blob:` URLs tied to that browser, not fetchable URLs). A test fake (`FakeRenderedPageSession`) and a Playwright implementation exist. The Playwright one (`src/live/java`, package `adapter.out.scraper.live`) is compiled only under the opt-in Maven profile `live-browser`, so the default build, tests and Docker image have no browser dependency. It owns pacing (shared `EvidenceRateLimiter`), the identifying user agent, bounded timeouts, the size cap, a same-host rule for top-level navigation, and scrubs notice/date/plate from error messages. `ScraperEvidenceFactory` uses it only when `cevoc.scraper.evidence.browser=playwright` AND `cevoc.scraper.enabled=true` AND `cevoc.scraper.evidence.enabled=true` (with base URL and contact); otherwise, or if the profile is not on the classpath, it wires the factory that always fails (UNAVAILABLE, nothing opened). The plate reaches the adapter only through `RequestScopedRegistration`, set by the loopback-only local check (see `docs/LIVE-CHECK.md`); there is no public supply path yet.

`RevenueNswPageParser.parse` returns one `Page` for any of the three states, decided by what is PRESENT (login inputs, summary rows, plate form, images, "Registration number:" row), not by page order. Rows are read by their visible labels; banner text is excluded so the banner's "Location:" is never mistaken for the notice's.

Camera code: read from the image banner text (`CameraBannerParser`), else from `s=` on the certificate link; carried on `PenaltyLookupResult.cameraCode` (`@JsonIgnore`, internal, not in the API) as the input for the future certificate lookup. The parser keeps only p, d, s, i from the link. The signed `m` value is read-only: it is never stored, logged or constructed, and no certificate URL is built.

Registration (plate) rules: comes only from a `RegistrationProvider` (none wired). It is a local variable for one request, passed to `submitPlate`, never logged (log lines carry no request values; exceptions are logged by class name only), cached, stored, or part of a cache or storage key; the parser never reads the "Registration number:" value. A result that used a plate is never cached. `ScraperEvidenceTest` asserts the plate never appears in captured log output.

Open question: what the site shows for a WRONG plate is unknown. "Plate form still present (or anything other than the images state) after submit" is treated as one generic result: notice details FOUND, no images, summary "registration number was not accepted". Also unknown: how a non-matching notice/date is shown on login (a login page after Next is treated as NOT_FOUND), the real markup of rows/notification box (selectors are guesses), whether the large image or a thumbnail is the better copy, and the owing amount wording (unpaid is assumed to owe the full penalty unless the box shows an amount).

### TODO before this can work against the real site
1. DONE (unverified against the live site): headless-browser `RenderedPageSession` adapter and owner-run local check (`scripts/live-check.sh`, `docs/LIVE-CHECK.md`).
2. Check parser selectors and fixtures against a saved real DOM (personal data removed); confirm date, time and amount formats.
3. Confirm the wrong-plate and not-found behaviour above.
4. Check robots.txt and terms; obtain written approval; agree rate limits and a contact address with the owner.
5. Then plan the move to the real evidence API and delete this adapter.

## Real page flow as reported by the owner (design notes only, 2026-10-30)
These notes record what the owner saw on the real pages so a future adapter or the real API can be modelled correctly. They contain no real values. Nothing here enables or builds any live access.

1. Penalty result page: shows date of offence, offence time, offence description, demerit points, penalty amount, location, amount owing and a paid/owing notice. Location is a free-text street and suburb string (for example "Example Road, EXAMPLETOWN"), not a site code. Mapping that string to a certificates location code needs an owner-supplied name-to-code table (site register), which must be kept private and out of this public repo.
2. Evidence is a second step: "Enter your vehicle registration number to view images". The plate is a runtime-only input. It must never be stored, logged, cached or committed, and fixtures must use obviously fictitious plates.
3. Evidence page: each image carries a banner of real, selectable text, so no OCR is needed. Reported fields: camera code (four digits), direction, operator, location (intersection text), incident number, lane, offence, speed limit, time since red, yellow light duration, date (dd Month yyyy) and time (hh:mm:ss.SSS). Each image has its own reference in a `700-1-<digits>` pattern. The page offers Download Images and a Camera Certification section with a "View certification details" link.
4. Certificates page lookup uses camera code and date window. RESOLVED (owner): the certificates "Location code" equals the camera code printed in the evidence banner.

Modelling implications (for whoever implements the real source): treat plate as a transient request parameter; carry the banner fields as a structured value on the evidence result; keep location as free text in the domain model.

Status: the parser, fixtures and the session port are built (see "Three-state myPenalty flow" above); the Playwright adapter exists behind the opt-in `live-browser` profile and has not been run against the live site. Live access to Revenue NSW pages still needs the owner's approval (robots.txt disallows it).

## Open questions
- How the Revenue NSW / Service NSW page accepts the two inputs, and whether it needs an identity step. Automated pass-through must be confirmed as permitted before building that adapter.
- The public certificates page (`/cevoc/pages/sdro/searchCertificates.jsf`) blocks automated fetching via robots.txt. Its form structure needs to be captured by a person.
- Certificates key: RESOLVED, location code plus date range (see the scraper section). Result layout and link exposure are now resolved (see above). Still open: real JSF ids, and whether the penalty page gives a real location code or only a place name.

## Index of decisions added 2026-11-05
- Flexible details map and the banner field audit: docs/decisions/0009-flexible-details-map.md.
- Three selectable routes per information type (Chromium, plain HTTP, API providers) and the plain HTTP adapter design: docs/decisions/0010-three-route-providers.md. Configuration choice: `cevoc.providers.<concern>` ordered list as described in docs/DIRECT-API-ROUTE.md; the default does not change until the owner says so.
- Evidence download and one-file evidence pack: docs/decisions/0011-evidence-pack.md.
- Road safety message rules (proposal): docs/decisions/0012-road-safety-message-rules.md.
- Per-program configuration, date-ranged versions, program lookup (design only, awaiting the owner): docs/decisions/0007-information-types-status-and-program-switches.md.
