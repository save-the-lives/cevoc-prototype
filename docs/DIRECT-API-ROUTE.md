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

Selection and fallback by config (all defaults keep today's behaviour; nothing live is ever the default):
- `cevoc.providers.notice-details=<id>[,<fallback-id>...]`, `cevoc.providers.evidence-images=...`, `cevoc.providers.certificates=...`. Mixed per concern is allowed (notice from one provider, certificates from another).
- Order is priority. The next provider is tried only on `UNAVAILABLE` or `not-supported` for that concern, never on `NOT_FOUND` (an authoritative no-match is final) and never after a registration was already sent to a provider that returned an answer for it (the plate is sent to as few providers as possible; a fallback needing the plate is an explicit config opt-in `cevoc.providers.allow-plate-fallback=true`, default false).
- A field marked missing by the winning provider may be filled from a lower-priority one only if `cevoc.providers.merge-fields=true` (default false), and the trace records which provider supplied each concern.
- The existing `cevoc.penalty-lookup.adapter` values (`manifest`, `stub`, `scraper-evidence`) keep working and map to single-provider setups. A future provider id such as `direct-api` gets its own enable flag, default OFF, and its own approval reference.

## 3. Contract tests
One shared abstract contract test per port, run against every provider, using only fictitious fixtures (notice 9000000004, plate TST123, camera 7109, incident 6): found with images, found without plate, wrong plate, no match, unsupported notice type, off, unavailable, image size/capturePath populated, trace names within the shared vocabulary, nothing sensitive in logs or trace. The browser route runs it through `FakeRenderedPageSession`; any new provider runs it through a fake of its own transport and canned fictitious responses. No live calls in tests.

## 4. Owner approval gate
Status: calling api.osr.nsw.gov.au is APPROVED by the owner (recorded in the project conversation, 2026-11-04). It stays OFF by default until a provider contract is built and passes the shared contract tests. Other sources (any other Transport for NSW or agency source or API) still need their own written owner approval before they run, and every provider refuses to start without its `<provider>.approval-reference`. Credentials, keys or tokens meant for another client (for example a web app's own) must not be copied or reused beyond what the approval covers. Preferred end state: an officially provided evidence API.

## Observed calls (redacted)
Placeholder. The real call shapes seen in the Chromium live run are recorded by the netmap work (branch `feat/netmap`) in `docs/OBSERVED-CALLS.md` or in this section. Not edited here; this document stays provider-agnostic.

## 5. When a provider is chosen, capture these
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
