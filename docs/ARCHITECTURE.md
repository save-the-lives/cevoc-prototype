# Architecture

Hexagonal. Dependencies point inwards: `adapter` -> `application` -> `domain`. `ArchitectureTest` enforces this.

    backend/src/main/java/au/gov/nsw/transport/cevoc
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
`CertificateSourcePort` (application/port/out) returns `CertificateRef`s for a `CertificateQuery`. The only adapter, `adapter/out/scraper`, reads the enforcement-centre certificates JSF page. It is NOT wired into the lookup flow and is never a default.
- Off unless `cevoc.scraper.certificates.enabled=true` (env `CEVOC_SCRAPER_CERTIFICATES_ENABLED`, default false). When enabled, `cevoc.scraper.certificates.approval-reference` (the owner's approval reference) is also required or startup fails.
- Polite: identifying User-Agent (`...user-agent`), min 5 s between requests (`...min-interval-ms`, floor 2000), connect/request timeouts, one request at a time, no retries, cache of at most 10 minutes (`...cache-ttl-seconds`, default 300).
- `CertificatePageParser` is the only class that knows the HTML and JSF ViewState handling. Tests use fictitious fixtures in `src/test/resources/scraper/certificates`, never live calls.
- Key strategy `cevoc.scraper.certificates.key-strategy`: `VIA_ENFORCEMENT_SITE` (default; RESOLVED, matches the real page) or `BY_PENALTY` (NOT supported by the real page; fictitious fixtures only). The real page "Customer Enquiry and Verification of Certificate" (`searchCertificates.jsf`) is keyed by mandatory `Location code`, `Date/Time from` and `Date/Time to` (dd/MM/yyyy HH:mm; "to" is pre-filled with now), with buttons SEARCH, CLEAR, CLOSE. It has no penalty number field, so the flow is penalty lookup -> `NoticeDetails.location` + offence date/time -> `EnforcementSiteResolver` -> location code -> certificates valid in the window.
- `CertificateQuery` carries `locationCode` + `from`/`to` (minute precision). The window is the whole offence day (00:00 to 23:59) by default; `cevoc.scraper.certificates.window-margin-minutes` (unset by default) narrows it to offence time +/- N minutes (0 to 1440). `CertificateScraperProperties.queryFor(...)` builds it.
- `EnforcementSiteResolver` (application/port/out) takes the lookup result's `NoticeDetails` and returns an optional location code. Only stub implementation: `ManifestEnforcementSiteResolver`, which maps the notice `location` text (case and spacing ignored) to the optional `locationCode` in `manifest.json` (fictitious codes such as `TEST-LOC-01`). It is not wired into the lookup flow. UNCONFIRMED: whether the penalty page exposes a real location code or only a descriptive place name. If only a name, the owner must supply a maintained name-to-code table.

### What is resolved and what is still unknown
- Resolved: the certificates page is keyed by location code plus date range, not penalty number.
- Unknown (owner to supply the saved page source or the results screenshot): the result table layout and column order; how the certificate PDF or link is exposed; the real JSF field ids (form, location code, date from, date to, SEARCH button). The ids in `CertificatePageParser` are guesses with a TODO, isolated as constants. Also unknown: results date format, "no results" message, any captcha or login.
- Production use still needs the owner's approval (robots.txt disallows automated access); the adapter stays off by default and keeps the approval-reference, polite rate limit and no-live-calls-in-tests safeguards. No real location codes or notice numbers belong in the repo.

- robots.txt disallows automated access. Production use needs the owner's approval, and this adapter should be replaced by the real certificate API.

## Scraper adapter (prototype only, off by default)
`adapter/out/scraper/` can read a Revenue NSW style penalty page and copy its images and videos into storage through `MediaStoragePort`, returning object keys like any other `PenaltyLookupPort`.

**Production use needs the site owner's (Revenue NSW / Service NSW) written approval first. It should be replaced by the real evidence API.** Transport for NSW (Arjan) obtains that approval before it is ever enabled. Until then it must stay off.

Safeguards:
- Never the default. `stub` stays the default in code, tests and every shipped config. It runs only if `cevoc.penalty-lookup.adapter=scraper-evidence` AND `cevoc.scraper.evidence.enabled=true` (env `CEVOC_SCRAPER_EVIDENCE_ENABLED`, default `false`). It also needs `cevoc.scraper.evidence.base-url` (https) and `cevoc.scraper.evidence.contact`; with any of these missing it returns `LIVE_LOOKUP_OFF` and makes no network call.
- Polite: identifying User-Agent (`CEVOC-prototype/0.1 (Transport for NSW; contact: ...)`), minimum 5 s between requests (`min-interval-ms`), connect and request timeouts, size cap (`max-bytes`), strictly sequential (no parallelism), images only from the browser session's own blob: handles, 2 minute result cache (`cache-ttl-seconds`, notice details only; never results with images). The pacing, timeout and size settings are for the future browser adapter to honour.
- Isolation: all HTML knowledge lives in `RevenueNswPageParser`; a site change should break only that class and its fixture.
- Tests (`ScraperEvidenceTest`) use saved fictitious DOM in `backend/src/test/resources/fixtures/scraper/` and a fake `RenderedPageSession`. No live network, no real notice numbers or personal data.

### Three-state myPenalty flow (building only; still off)
Source: the owner's description of the real flow (no live request has ever been made; all fixtures are FICTITIOUS: notice 9000000004, plate TST123, camera code 7109, incident 6).
1. Login (Angular app, base href `/customer_service/finesonline/`): inputs `pnn` and `dateOfOffence` (DD/MM/YYYY), a Next button; hidden, disabled `lastName`, `firstName`, `organisation` exist for some notice types (if one is enabled, the notice type is out of scope and the lookup is UNAVAILABLE).
2. Summary: heading "Penalty Notice Number - n", a paid/owing notification box, rows "Date of offence:", "Offence Time:", "Offence Description:", "Demerit Points:", "Penalty Amount:", "Location:" (free text, not a code). The Images section is a separate form with one field `vehicleNumber` ("Registration number:") and a "View images" button; "Registration number is required" shows when empty. No "Registration number:" row yet.
3. Images: the plate form is replaced by the images section; a "Registration number:" row appears; a large image plus thumbnails, each with a ref like `700-1-<digits>`; "Download Images"; "Camera Certification" with a "View certification details" link to `certificateDetails.jsf` (query p notice, d offence date-time, s camera code, i incident number, m signed value).

Because the site is Angular, a plain HTTP fetch returns an empty shell, so the adapter talks to a small port, `RenderedPageSession` (+ `RenderedPageSessionFactory`): `loginPage()`, `submitLogin(notice, DD/MM/YYYY)`, `submitPlate(plate)` each return the rendered DOM, and `imageBytes(blobUrl)` returns image bytes from the SAME session (images are `blob:` URLs tied to that browser, not fetchable URLs). Only the interface and a test fake (`FakeRenderedPageSession`) exist. No Playwright/Selenium dependency is added. **Next step: a headless-browser adapter behind this port** (it must own pacing, the identifying user agent, timeouts and the size cap, and must never log or trace the plate). Until then `ScraperEvidenceFactory` wires a factory that always fails, so even an enabled scraper reports UNAVAILABLE and opens nothing.

`RevenueNswPageParser.parse` returns one `Page` for any of the three states, decided by what is PRESENT (login inputs, summary rows, plate form, images, "Registration number:" row), not by page order. Rows are read by their visible labels; banner text is excluded so the banner's "Location:" is never mistaken for the notice's.

Camera code: read from the image banner text (`CameraBannerParser`), else from `s=` on the certificate link; carried on `PenaltyLookupResult.cameraCode` (`@JsonIgnore`, internal, not in the API) as the input for the future certificate lookup. The parser keeps only p, d, s, i from the link. The signed `m` value is read-only: it is never stored, logged or constructed, and no certificate URL is built.

Registration (plate) rules: comes only from a `RegistrationProvider` (none wired). It is a local variable for one request, passed to `submitPlate`, never logged (log lines carry no request values; exceptions are logged by class name only), cached, stored, or part of a cache or storage key; the parser never reads the "Registration number:" value. A result that used a plate is never cached. `ScraperEvidenceTest` asserts the plate never appears in captured log output.

Open question: what the site shows for a WRONG plate is unknown. "Plate form still present (or anything other than the images state) after submit" is treated as one generic result: notice details FOUND, no images, summary "registration number was not accepted". Also unknown: how a non-matching notice/date is shown on login (a login page after Next is treated as NOT_FOUND), the real markup of rows/notification box (selectors are guesses), whether the large image or a thumbnail is the better copy, and the owing amount wording (unpaid is assumed to owe the full penalty unless the box shows an amount).

### TODO before this can work against the real site
1. Build the headless-browser `RenderedPageSession` adapter (and a way to run it in CI-free, owner-approved conditions).
2. Check parser selectors and fixtures against a saved real DOM (personal data removed); confirm date, time and amount formats.
3. Confirm the wrong-plate and not-found behaviour above.
4. Check robots.txt and terms; obtain written approval; agree rate limits and a contact address with the owner.
5. Then plan the move to the real evidence API and delete this adapter.

## Real page flow as reported by the owner (design notes only, 2026-10-30)
These notes record what the owner saw on the real pages so a future adapter or the real API can be modelled correctly. They contain no real values. Nothing here enables or builds any live access.

1. Penalty result page: shows date of offence, offence time, offence description, demerit points, penalty amount, location, amount owing and a paid/owing notice. Location is a free-text street and suburb string (for example "Example Road, EXAMPLETOWN"), not a site code. Mapping that string to a certificates location code needs an owner-supplied name-to-code table (site register), which must be kept private and out of this public repo.
2. Evidence is a second step: "Enter your vehicle registration number to view images". The plate is a runtime-only input. It must never be stored, logged, cached or committed, and fixtures must use obviously fictitious plates.
3. Evidence page: each image carries a banner of real, selectable text, so no OCR is needed. Reported fields: camera code (four digits), direction, operator, location (intersection text), incident number, lane, offence, speed limit, time since red, yellow light duration, date (dd Month yyyy) and time (hh:mm:ss.SSS). Each image has its own reference in a `700-1-<digits>` pattern. The page offers Download Images and a Camera Certification section with a "View certification details" link.
4. Certificates page lookup would use camera code and date window. Still UNCONFIRMED: whether the certificates "Location code" equals the evidence camera code. The owner is checking by hand.

Modelling implications (for whoever implements the real source): treat plate as a transient request parameter; carry the banner fields as a structured value on the evidence result; keep location as free text in the domain model.

Status: the parser, fixtures and the session port are built (see "Three-state myPenalty flow" above); no browser adapter exists and no live request is made. Live access to Revenue NSW pages still needs the owner's approval (robots.txt disallows it).

## Open questions
- How the Revenue NSW / Service NSW page accepts the two inputs, and whether it needs an identity step. Automated pass-through must be confirmed as permitted before building that adapter.
- The public certificates page (`/cevoc/pages/sdro/searchCertificates.jsf`) blocks automated fetching via robots.txt. Its form structure needs to be captured by a person.
- Certificates key: RESOLVED, location code plus date range (see the scraper section). Still open: result layout, certificate link exposure, real JSF ids, and whether the penalty page gives a real location code or only a place name.
