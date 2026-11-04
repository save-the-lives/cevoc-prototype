# Provider-agnostic lookup: canonical shape and provider contract (design, placeholder)

Status: design only, nothing built, nothing contacted. Which TfNSW sources or APIs will exist, how many, and what they expose is not known yet. This page therefore defines what the CEVOC page needs, independent of any provider, and the small contract any provider (the browser route today, an API or another agency source later) must meet. A direct JSON API is just one possible provider. No real data appears here; fixtures stay fictitious.

## 1. Canonical lookup result (what the CEVOC page needs)
A provider never changes this shape; it only fills what it can. Each part carries its own status so a partial answer is still usable.

- Lookup: `status` (FOUND, NOT_FOUND, UNAVAILABLE, LIVE_LOOKUP_OFF, LIVE_LOOKUP_DISABLED, as `PenaltyLookupResult.Status` today), `source` (provider id), `summary` text.
- Notice details (`NoticeDetails`): offence description, offence date, offence time, location (free text, never assumed to be a site code), demerit points, penalty amount, amount owing, paid/owing status and message, enforcement method.
- Evidence images, each: `ref` (display reference), `objectKey` (storage key via `MediaStoragePort`, never derived from plate or ref), `contentType`, `widthPx` and `heightPx` (pixel size of the stored bytes), `byteSize`, `capturePath` (how the bytes were obtained: `API_ORIGINAL`, `DOWNLOAD_ORIGINAL`, `BLOB_FETCH`, `CANVAS_REENCODE`, `ELEMENT_SCREENSHOT`; lets the page and the live check flag anything below original quality), optional banner fields (direction, operator, lane, speed limit, times) as structured data. Originals are preferred; a lower-fidelity path is allowed but must be labelled.
- Camera code: internal only (`@JsonIgnore`); input to the certificates concern; equals the certificates Location code.
- Certificates: list of description, type, period text, certified date, expiry date, `coversOffence`; optional document reference exactly as given by the source (signed links are never constructed).
- Step trace: ordered list of `{step, outcome, provider}` with outcome in `ok`, `skipped`, `not-supported`, `failed(cause-class)`. No values, ever (no notice, plate, dates, amounts, location, camera code, tokens). Step names are shared with the browser route: `start-browser`, `open-login`, `submit-login`, `read-summary`, `give-plate`, `view-images`, `capture-images`, `certificates` (to be confirmed by the coming step trace; this list is the single vocabulary, owned by `LookupDiagnostic`). A non-browser provider reports `not-supported` or `skipped` for steps it does not need (for example `start-browser`, `open-login`) rather than inventing names.
- Transient inputs: notice number, offence date, registration. The registration is request-scoped: never logged, cached, stored, in a key, in a trace or in an error message. Anything that used it is never cached.

## 2. Provider contract: one small port per concern
Three driven ports (application/port/out), each returning canonical parts, not provider types:

1. `NoticeDetailsPort`: (notice, offence date) to notice details + status + `needsRegistration` flag. Covers steps `open-login`, `submit-login`, `read-summary`.
2. `EvidenceImagesPort`: (notice context, registration) to images (metadata + stored bytes) + banner fields + camera code. Covers `give-plate`, `view-images`, `capture-images`. May need context from port 1 (a provider-private session handle, opaque to the app, held for one lookup only).
3. `CertificatesPort`: (camera code, offence window) to certificate rows. Covers `certificates`. This is today's `CertificateSourcePort`.

Today's `PenaltyLookupPort` stays as the facade the service uses: a `CompositePenaltyLookup` assembles the three concerns, so existing callers, controller and tests do not change. The browser route is adapted to all three at once (it does notice details and images in one session); a provider that spans concerns may implement several ports and share its session.

Capability declaration: each provider exposes a `ProviderCapabilities` value (static, no I/O):
- `id` (for example `browser`, `manifest`, `stub`, later `agency-x-api`);
- `concerns`: which of the three ports it implements;
- `steps`: which trace steps it performs;
- `fields`: which canonical fields it fills (for example `images.widthPx`, `images.capturePath=API_ORIGINAL`, `notice.demeritPoints`, `certificates.documentRef`);
- `requiresApproval`: whether it needs an owner approval reference before it will run.
The app checks capabilities at startup and fails fast on a config that selects a provider for a concern it does not implement.

Precedence (direction from the owner): Transport for NSW is the source of truth for most of this data. Revenue NSW is an INTERIM provider, to be substituted by TfNSW APIs concern by concern. Per concern (penalty details, evidence images, camera/certificates, anything else) the config holds an ordered provider list; TfNSW providers come first when available and Revenue NSW is the interim fallback, for example `cevoc.providers.notice-details=tfnsw-penalty,revenue-nsw`. Because the canonical shape (section 1) is provider-neutral, swapping or reordering providers changes no page code: only config and the provider adapters.

Selection and fallback by config (all defaults keep today's behaviour; nothing live is ever the default):
- `cevoc.providers.notice-details=<id>[,<fallback-id>...]`, `cevoc.providers.evidence-images=...`, `cevoc.providers.certificates=...`. Mixed per concern is allowed (notice from one provider, certificates from another).
- Order is priority. The next provider is tried only on `UNAVAILABLE` or `not-supported` for that concern, never on `NOT_FOUND` (an authoritative no-match is final) and never after a registration was already sent to a provider that returned an answer for it (the plate is sent to as few providers as possible; a fallback needing the plate is an explicit config opt-in `cevoc.providers.allow-plate-fallback=true`, default false).
- A field marked missing by the winning provider may be filled from a lower-priority one only if `cevoc.providers.merge-fields=true` (default false), and the trace records which provider supplied each concern.
- The existing `cevoc.penalty-lookup.adapter` values (`manifest`, `stub`, `scraper-evidence`) keep working and map to single-provider setups. A future provider id such as `direct-api` gets its own enable flag, default OFF, and its own approval reference.

## 3. Contract tests
One shared abstract contract test per port, run against EVERY provider (browser, Revenue NSW, each TfNSW one, stub, manifest) so any of them is interchangeable, using only fictitious fixtures (notice 9000000004, plate TST123, camera 7109, incident 6): found with images, found without plate, wrong plate, no match, unsupported notice type, off, unavailable, image size/capturePath populated, trace names within the shared vocabulary, nothing sensitive in logs or trace. The browser route runs it through `FakeRenderedPageSession`; any new provider runs it through a fake of its own transport and canned fictitious responses. No live calls in tests.

## 4. Owner approval gate (per source)
- Revenue NSW, api.osr.nsw.gov.au: APPROVED by the owner (recorded 2026-11-04). Still OFF by default until its provider contract is built and passes the shared contract tests.
- Each TfNSW source or API (and any other agency source): needs its own owner approval before it runs.
- Every provider refuses to start without its `<provider>.approval-reference`. Credentials, keys or tokens meant for another client must not be copied or reused beyond what the approval covers.

## 4a. Revenue NSW provider (interim)
Provider id `revenue-nsw`, host api.osr.nsw.gov.au (approved, see gate). Interim: to be replaced concern by concern by TfNSW providers; keep all Revenue NSW knowledge (URLs, JSON field names, auth carrier) in its own adapter package and mapper so removal later is deletion only. It maps to the canonical shape and the shared step names; `capturePath` is `API_ORIGINAL` only if the full-size call returns the original bytes.

Capture checklist (what the live-run recorder on `feat/netmap` covers; it is not something to ask the owner for). For each call record: method, URL pattern (IDs as `{notice}`, `{id}`), request header NAMES only, body shape (field names and types), response status, content type and body shape (field names, types, array sizes).
1. Login/identify call (notice number + offence date): method, body field names, what it returns (token or cookie, notice id), and the non-match response (status, error body shape).
2. Details/summary call: URL pattern, how it is authorised, full response field list including paid/owing and the "needs registration" indicator.
3. Images list call ("View images" with registration): body field names, response listing (image ids, refs, banner fields, certificate link parts), and the wrong-registration response.
4. Full-size image fetch: URL pattern, request header names, content type, byte size, pixel size, whether thumbnails use a different URL, whether "Download Images" is a separate original-quality call.
5. Certification link call ("View certification details"): URL pattern, parameter names only (p, d, s, i, m), response shape (rows or a document).
6. Auth carrier names: which header, cookie or query parameter carries the credential (NAMES only), where it is first issued, its lifetime if visible, and any anti-forgery/CSRF header name.
Redaction rules: replace with `REDACTED` the notice number, dates/times, registration, names, addresses, amounts, location, camera code, incident number, image refs, every `m=` value, tokens, cookies, `Authorization`/`Cookie`/`Set-Cookie` values, session ids, IPs and personal values in bodies; drop image and PDF bodies (keep type, byte size, pixel size); keep methods, hosts, path structure, header names, field names, JSON types, status codes, content types, sizes, array lengths. Search for the notice, registration and first 8 characters of any token before anything is shared; never commit raw captures to this public repo.

## Observed calls (redacted)
Source: the structure-only network map of the Chromium live run (live-check request flag `networkMap=true`, workflow input `network_map`, code `NetworkMapRedaction`/`NetworkMapRecorder`), 4 live rounds on 2026-11-04 with one real case (two rounds reached the images step, two stalled at the summary call, see Reliability). Only redacted structure is recorded here: no values, no real identifiers. Identifier path segments print as `{id:<mask>#<tag>}` (mask: A upper, a lower, 9 digit; tag: salted hash, equal tags within one run mean the same value, nothing comparable across runs). Host of the JSON service: `api.osr.nsw.gov.au` (approved, see section 4). Not observed: the non-match response (wrong notice/date), a wrong-registration response, response header values, pixel size of the images (the JPEG header was not readable by the first parser; fixed afterwards but not seen on a successful run), and the certificate page response.

### Calls per lookup step
Base path of the JSON service: `/{prefix}/rest/api/v2/fines`, where `{prefix}` is one constant-looking segment of the shape `AAAAA_AAAAAA_AAA` (16 characters, upper case with underscores, identical in every call and in all runs; presumably a fixed application or tenant name; confirm before hard-coding, do not assume it is public).

| Step | Call (method, path pattern) | Notes |
|---|---|---|
| open-login | `GET www.apps09.revenue.nsw.gov.au/customer_service/finesonline` (document, then `/login`); assets; Cloudflare `POST /cdn-cgi/challenge-platform/h/g/jsd/oneshot/...` and `POST /cdn-cgi/rum`; Google Analytics `POST /g/collect` | The page is an Angular app behind Cloudflare. Only the page shell; no notice data. |
| submit-login | `POST /{prefix}/rest/api/v2/fines/token` | Identify the notice. See below. |
| read-summary | `GET .../fines`, `GET .../fines/services`, `GET .../fines/notifications` | All with `authorization` + `pnnum` request headers. |
| give-plate | no API call | Only the form is filled (analytics beacon). |
| view-images | `POST .../fines/token` (second token), then `GET .../fines/images/{id}?size=thumbnail`, `?size=medium`, `?size=full` | See below. |
| capture-images | none | Images are already fetched by the page and held as blob URLs; the live check reads them in the page. |
| certificates | `GET cevoc.transport.nsw.gov.au/cevoc/pages/public/certificateDetails.jsf?d&i&m&p&s` (document) | Different host (TfNSW). The link comes from the summary response. |

### Login (submit-login)
- `POST .../fines/token`, request headers (names): accept, accept-language, content-type, origin, **pnnum**, referer, sec-ch-ua*, user-agent. No `authorization`, no `cookie`. The notice number travels in the `pnnum` header (value not recorded); the body is JSON `{offenceDate:string(date)}`.
- Response 200 `application/json`: `{token:string(JWT), credentials:{offenceDate:bool}, timestamp:string(date)}` (under 1 KB). So yes: the login call returns a token, in the BODY field `token` (a JWT-shaped string). `credentials` says which supplied credentials were accepted.
- Response header names: access-control-allow-headers, access-control-allow-origin, allow, connection, content-type, date, server, transfer-encoding, x-application-context, x-powered-by (a Spring-style service; no Cloudflare headers).

### How the token is carried
- Every later API call sends it in the request header **`authorization`** (the first word is neither `Bearer` nor `Basic`, so it is either the bare token or a custom scheme; confirm with one more run) together with the header **`pnnum`**. No cookies are sent to the API host.
- API responses after login include an **`authorization` response header** (rotated or refreshed token). A direct client must read it back and use the newest value.
- Each call also sends `origin` and `referer` (the myPenalty site); CORS response headers are present. Whether the server checks them for non-browser callers is not known.

### Summary (read-summary)
- `GET .../fines` 200 json (under 10 KB): `{pnNum:string, notifications:array<n>({message:{code,text}}), offence:{desc,date,time,demerit:{points:number,disclaimer:{code,text,placeholder:array<n>({key,value,resource})}},amount:number,location:{street,suburb}}, payment:{outstanding:{amount:number},transactions:array<n>({date,status:{code,text,message:{code,text}}})}, images:{count:number, identifiers:array<n>(string), cameraCertification:{ref:string(URL), type:string}}, timestamp, seriousOffence:bool}`.
- `images.identifiers` are the image ids used in the image path; `images.cameraCertification.ref` is an absolute URL to the TfNSW certificate page (see Certificates).
- `GET .../fines/services` 200 json: an eligibility map, one object per service (`summary`, `payment`, `images`, `review`, `reviewAddInfo`, `court`, `nomination`, `eNomination`, `contact`, `enquiry`, `notifications`, `eo`, ...), each `{eligible:bool, authorisation:{authorisedRoles:array<n>(string)}, resource:{ref:string,type:string}, credentials:{pnNum:bool,offenceDate:bool,...}}`. The `images` entry lists `vehicleRego:bool` among the required credentials, which is how the app knows to ask for the registration.
- `GET .../fines/notifications` 200 json: `{pnNum, notifications:array<n>({message:{code,text}}), timestamp}`.

### View images (give-plate, view-images)
- Clicking "View images" first calls `POST .../fines/token` again, with body `{offenceDate:string(date), vehicleRego:string}` and the same headers; the response has the same shape with `credentials:{offenceDate:bool,vehicleRego:bool}` and a NEW token. The registration is checked server-side when this token is issued (the wrong-registration response was not observed).
- Then image calls: `GET .../fines/images/{id}?size=<thumbnail|medium|full>`, request headers `authorization` and `pnnum` (plus accept, origin, referer, user-agent; no content-type, no cookie), response 200 `image/jpeg` with a `content-disposition` header. The page requested, for the first image id, `medium`, `full` and `thumbnail`, and for the second id `thumbnail` (the image count on the page was 3 in these runs).
- Sizes seen (rounded to 10 KB): thumbnail about 10 KB, medium about 680 KB, full about 1440 KB. The `size=full` response is a plain JPEG fetched by a plain authorised GET.

### How images are retrieved (full resolution, direct route)
A direct client can fetch originals without a browser: take the identifiers from the summary, obtain the images token (token call with the registration), then `GET .../images/{id}?size=full` with `authorization` and `pnnum`. Whether `size=full` is the camera's original or a recompressed copy, and its pixel size, still needs one confirmation (pixel size is printed by the map on the next successful run; the magic bytes and JPEG markers are printed when the size cannot be read). The browser route only sees what the page requests (here including `size=full`), so `capturePath` for a direct fetch would be `API_ORIGINAL`.

### Certificates
- The summary response carries `images.cameraCertification.ref`, an absolute URL on `cevoc.transport.nsw.gov.au`, path `/cevoc/pages/public/certificateDetails.jsf`, with query parameter NAMES `d`, `i`, `m`, `p`, `s` (values not recorded; `m` is the opaque parameter mentioned in section 4a). The page opens it as a normal document navigation.
- In the map the document request showed no response (still pending when the session closed) in the run that reached it; the certificate result in that run was 0 rows. So the shape of the certificate response is NOT yet observed, and it is an HTML (JSF) page on a TfNSW host, not part of the Revenue NSW JSON service. It falls under the TfNSW approval gate (section 4b), not the Revenue NSW approval.

### Certificates provider list (the cutover seam, built)
**The browser option is PROTOTYPE-ONLY** (`search-page` and `browser-link`, the Chromium session, the `live-browser` profile, the live-check endpoints): production uses the API providers and the browser pieces are deleted at cutover (list in docs/ARCHITECTURE.md). Live-mode default order is `search-page`; `search-page-http` is kept and tested but not in the default order; `tfnsw-api` is added in front by config.

Certificates are the one concern whose provider list exists in code today: `cevoc.certificates.providers` is an ordered, comma-separated list (env `CEVOC_CERTIFICATES_PROVIDERS`), every provider implements `CertificateSourcePort` and returns the canonical shape below, and `CertificateProviders` / `CertificateProviderChain` pick and order them. Nothing listed (the default) means no certificate source and the `certificates` step reports skipped.

| id | what it is | status |
|---|---|---|
| `search-page-http` | the same search page with plain HTTP and no browser: GET it, read the JSF hidden fields and field names from the page, POST the search form (camera code, offence day); fresh in-memory cookie per lookup | INTERIM, same owner approval (2026-11-04); replaced by `tfnsw-api`. Not in the default order |
| `search-page` | the public search page `searchCertificates.jsf` in its own headless-browser session: camera code as Location code, offence day as Date/Time from and to | INTERIM. Approved by the project owner on 2026-11-04 although robots.txt disallows automated access. Replaced by `tfnsw-api` when that exists |
| `tfnsw-api` | the TfNSW certificate API | reserved; listing it today fails at start-up with "not available yet" |
| `http-form` | plain HTTP form scraper (older design) | legacy; also what `cevoc.scraper.certificates.enabled=true` selects when no list is given |
| `browser-link` | follows the signed `certificateDetails.jsf` deep link from the evidence page | legacy and NOT the default: it answers 403 (also in the owner's own browser) |

Cutover is a config change only: `cevoc.certificates.providers=tfnsw-api,search-page` while both exist, then `tfnsw-api` alone. Chain rules (the step trace notes `cert-provider=<id>` for the one that answered and `cert-provider-failed=<id>` for earlier ones; ids only): the first provider that answers ends the chain (an empty list is an answer); a provider that fails hands over to the next; a refusal (`blocked-401`, `blocked-403`, `blocked-429`) stops the chain at once and is never retried or worked around. Every provider passes the same fictitious-fixture contract tests (`CertificateSourceContractTest` and its subclasses): same rows in page order, covering rows marked, no results gives an empty list.

Canonical result (what any provider returns, via `CertificateRef`, shown to the page as `CertificateItem`): `description`, `type`, `periodText` (as shown) with parsed `periodFrom`/`periodTo`, `certifiedDate`, `expiryDate` and an optional `documentRef` exactly as given by the source; the page receives `{description, type, periodText, certifiedDate, expiryDate, coversOffence}` with dates as `yyyy-MM-dd`. `coversOffence` is true when the Period window contains the offence date and time. The camera code is the query input (Location code) and is never part of the result.

Every provider that contacts a source needs the owner's approval reference (`cevoc.certificates.approval-reference`, env `CEVOC_CERTIFICATES_APPROVAL_REFERENCE`). The live-mode deploy passes the provider and the fixed owner approval reference `owner-approved-2026-11-04`.

### Feasibility of a direct (browser-free) route
Looks feasible for notice details and images, with caveats:
- No bot protection was seen on the JSON service: no cookies, no CAPTCHA, no CSRF header, no signed query parameters or request signatures; calls are authorised by the JWT-like token in `authorization` plus the `pnnum` header. Cloudflare (JS detection, RUM) sits only in front of the myPenalty web pages, which a direct client would not need to load.
- Token handling is a short chain: token call (notice + date), then summary calls; a second token call (adds the registration) before image calls; always send the newest `authorization` value (it comes back in a response header). Token lifetime and whether the old token keeps working after rotation were not observed.
- Unknowns before building: the meaning and stability of the `{prefix}` path segment, the exact `authorization` format, whether the server enforces `origin`/`referer`/User-Agent for non-browser callers, rate limits and terms, the non-match and wrong-registration responses, pixel size and originality of `size=full`.
- The certificate page is separate (TfNSW host, HTML) and needs its own decision.

### Reliability seen in the live run
In 2 of 4 runs the `GET .../fines` summary call never completed (the map shows it pending) and the lookup ended at "page not recognised at summary"; the other two runs completed with the same inputs. A direct client needs a timeout and a bounded retry for that call.

## 4b. TfNSW providers (to be defined)
Placeholder. TfNSW is the intended source of truth; the following are UNKNOWN and must be settled before any TfNSW provider is built:
- which APIs or systems exist, and how many (penalty notice, evidence images, camera registers, certificates, others);
- which concerns and canonical fields each covers (pixel size, original bytes, certificate documents);
- request/response shapes, identifiers and keys (is the camera code the key?), pagination, errors;
- authentication and authorisation (service credentials, gateway, network path), rate limits and terms;
- environments (test vs production) and who owns each.
Each TfNSW source gets its own provider id, capability declaration, approval reference and fixture contract tests. When one is chosen, capture the same items as 4a (identify call, details, images list, full-size image, certificate call, auth carrier names, redaction rules) and replace Revenue NSW for that concern by putting it first in the ordered list.

## 5. Capture when a provider is chosen (any source)
Short list, owner, own notice, private browser window, nothing committed to this public repo:
- the call that identifies a notice (method, URL pattern, header NAMES, body field names, response field names/types, and what a non-match returns);
- the calls that return notice details, the image list, one full-size image (content type, byte size, pixel size) and certificates;
- how each call is authorised (header or cookie NAME only) and any rate limits or terms.
Redact notice number, dates, plate, names, amounts, location, camera code, incident, image refs, `m=` values, tokens, cookies and bodies of images/PDFs; keep methods, paths, header names, field names, types, status codes, sizes.

## 6. Risks
Terms/authorisation (gate above); undocumented APIs change without notice (contract tests plus the browser provider as fallback); an API may serve resized or watermarked images (hence `capturePath` and pixel size in the canonical shape); mixed providers can disagree (merge is off by default and the trace names the source); plate spread (fallback rule above); privacy of captures and logs.

## 7. Rollout
1. Land this contract and the trace vocabulary; refactor behind the existing facade with the browser route as the only provider (no behaviour change, tests unchanged).
2. Add `capturePath` and pixel size to images in the browser provider; show them in the redacted live-check summary.
3. When a second provider is chosen and approved: capture (section 5), implement it against fictitious fixtures, pass the shared contract tests, flag OFF.
4. Side by side in the live check: run both providers for the same concern in turn and compare redacted summaries (state, fields found, image count, size buckets, certificate count).
5. Switch by config priority; keep the old provider as fallback for one cycle; retire it later. Rollback is config only.
