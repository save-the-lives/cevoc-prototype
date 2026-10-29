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

## Certificates in the lookup response
`LookupPenaltyService` (application layer) adds a `certificates` list to the lookup result. After the evidence lookup yields an internal camera code, it calls `CertificateSourcePort.findCertificatesCovering(query, offenceAt)` with `locationCode = cameraCode` and a window from `CertificateQuery.aroundOffence` (whole offence day, or offence time +/- `cevoc.scraper.certificates.window-margin-minutes`). The whole list is returned, in page order, with `coversOffence` true on the row(s) whose Period contains the offence date/time.
- JSON: `certificates: [{description, type, periodText, certifiedDate, expiryDate, coversOffence}]`, dates as `yyyy-MM-dd` strings. The camera code, plate and links are never in the response (`cameraCode` stays `@JsonIgnore`). The existing certificate evidence item is unchanged.
- Adapters that already carry certificates are left as they are: the manifest adapter maps optional `certificates` rows in `manifest.json` (fictitious; `periodFrom`/`periodTo` decide the covering row) into the same shape.
- No camera code, or the certificate port disabled (scraper off, the default): empty list, no query. A certificate failure never fails the lookup: it degrades to an empty list with an internal `certificatesNote` (not serialised).

## Scraper adapter (prototype only, off by default)
`adapter/out/scraper/` can read a Revenue NSW style penalty page and copy its images and videos into storage through `MediaStoragePort`, returning object keys like any other `PenaltyLookupPort`.

**Production use needs the site owner's (Revenue NSW / Service NSW) written approval first. It should be replaced by the real evidence API.** Transport for NSW (Arjan) obtains that approval before it is ever enabled. Until then it must stay off.

Safeguards:
- Never the default. `stub` stays the default in code, tests and every shipped config. It runs only if `cevoc.penalty-lookup.adapter=scraper-evidence` AND `cevoc.scraper.evidence.enabled=true` (env `CEVOC_SCRAPER_EVIDENCE_ENABLED`, default `false`). It also needs `cevoc.scraper.evidence.base-url` (https) and `cevoc.scraper.evidence.contact`; with any of these missing it returns `LIVE_LOOKUP_OFF` and makes no network call.
- Polite: identifying User-Agent (`CEVOC-prototype/0.1 (Transport for NSW; contact: ...)`), minimum 5 s between requests (`min-interval-ms`), connect and request timeouts, 25 MB size cap, strictly sequential (no parallelism), no redirects, media only from the same https host, 2 minute result cache (`cache-ttl-seconds`).
- Isolation: all HTML knowledge lives in `RevenueNswPageParser`; a site change should break only that class and its fixture.
- Tests (`ScraperEvidenceTest`) use saved fictitious HTML in `backend/src/test/resources/fixtures/scraper/` and fakes. No live network, no real notice numbers or personal data.

### Two-step page flow (building only; still off)
The parser now follows the real myPenalty flow, taken from the owner's screenshots (no live request has been made):
1. Result page (`RevenueNswPageParser.parse`): Date of offence, Offence Time, Offence Description, Demerit Points, Penalty Amount, Location (street and suburb only, not a code), Amount owing, and a paid/payable notice. These are read by their visible labels. The page also has the Images section, which needs the vehicle registration plus "View images"; the parser only finds that form (`ImagesStep`).
2. Images page (`parseImages`, only when a registration is supplied): image items (refs like `700-1-...`), "Download Images", and "Camera Certification / View certification details". Each image's banner is selectable text, read by `CameraBannerParser` (Camera Code, Direction, Operator, Location, Incident Number, Lane, Offence, Speed Limit, Time since red, Yellow light duration, Date, Time). Every field is optional; the red-light fields are absent for speed cameras. The camera code is the key output.

The camera code is carried on `PenaltyLookupResult.cameraCode` (`@JsonIgnore`), so it is internal: not in the API response and no frontend change. It is the future input to the certificate lookup, replacing the guessed location code.

The vehicle registration comes only from a `RegistrationProvider` (none is wired, so step 2 is skipped today). It is held in a local variable for that one request, sent in the POST body, and never stored, logged, cached or put in fixtures. A result that used a plate is never cached, and storage keys do not derive from it.

### TODO before this can work against the real site
The label-based step 1 reading is expected to be close, but the form action and field names, the image item markup and the exact banner layout are guesses (fixtures are fictitious).
1. Confirm how the notice inputs are submitted (GET, POST form, token or captcha, identity step) and update `searchUri`.
2. Check the parser selectors and fixtures against a saved real page (personal data removed); confirm date, time and amount formats.
3. Confirm how images are served (direct files, lazy loading). Streamed video cannot be buffered by this adapter.
4. Check robots.txt and terms; obtain written approval; agree rate limits and a contact address with the owner.
5. Then plan the move to the real evidence API and delete this adapter.

## Real page flow as reported by the owner (design notes only, 2026-10-30)
These notes record what the owner saw on the real pages so a future adapter or the real API can be modelled correctly. They contain no real values. Nothing here enables or builds any live access.

1. Penalty result page: shows date of offence, offence time, offence description, demerit points, penalty amount, location, amount owing and a paid/owing notice. Location is a free-text street and suburb string (for example "Example Road, EXAMPLETOWN"), not a site code. Mapping that string to a certificates location code needs an owner-supplied name-to-code table (site register), which must be kept private and out of this public repo.
2. Evidence is a second step: "Enter your vehicle registration number to view images". The plate is a runtime-only input. It must never be stored, logged, cached or committed, and fixtures must use obviously fictitious plates.
3. Evidence page: each image carries a banner of real, selectable text, so no OCR is needed. Reported fields: camera code (four digits), direction, operator, location (intersection text), incident number, lane, offence, speed limit, time since red, yellow light duration, date (dd Month yyyy) and time (hh:mm:ss.SSS). Each image has its own reference in a `700-1-<digits>` pattern. The page offers Download Images and a Camera Certification section with a "View certification details" link.
4. Certificates page lookup uses camera code and date window. RESOLVED (owner): the certificates "Location code" equals the camera code printed in the evidence banner.

Modelling implications (for whoever implements the real source): treat plate as a transient request parameter; carry the banner fields as a structured value on the evidence result; keep location as free text in the domain model.

Status: parser, fixtures and any adapter changes for this flow are NOT done in this change. Live access to Revenue NSW pages is not approved for building here (robots.txt disallows it); the owner needs to confirm approval before that work is picked up.

## Open questions
- How the Revenue NSW / Service NSW page accepts the two inputs, and whether it needs an identity step. Automated pass-through must be confirmed as permitted before building that adapter.
- The public certificates page (`/cevoc/pages/sdro/searchCertificates.jsf`) blocks automated fetching via robots.txt. Its form structure needs to be captured by a person.
- Certificates key: RESOLVED, location code plus date range (see the scraper section). Result layout and link exposure are now resolved (see above). Still open: real JSF ids, and whether the penalty page gives a real location code or only a place name.
