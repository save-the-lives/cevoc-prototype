# 0010. Three selectable routes per information type

Status: ACCEPTED as direction by the owner (voice, 2026-11-05). The plain HTTP adapter for the Revenue NSW JSON service is DESIGNED here and NOT built or live-tested in the session that wrote this record (no Maven access and no permitted way to run the live check there). Results labelled UNTESTED must be filled in by a run that can.
Date recorded: 2026-11-05
Owner approval: given by voice 2026-11-05 (default does not change until the owner says so)

## Decision
For each information type the provider is chosen in configuration, from three kinds of route behind the same port:
1. Chromium scraper (prototype only, today's route; stays fully working).
2. Plain HTTP adapter for the Revenue NSW JSON service (api.osr.nsw.gov.au, approved 2026-11-04): no browser.
3. API providers (TfNSW or others), reserved.
Switching is a configuration change. The default stays as today until the owner says otherwise. All three return the same canonical result (including the `details` map, record 0009), the same redacted step trace and cause tokens, and pass the same fixture-based contract tests.

## Plain HTTP adapter: design
- Package: `adapter.out.revenuensw` (all Revenue NSW URLs, header names and JSON field names live there; removal later is deletion). Provider id `revenue-nsw-http`; config `cevoc.providers.notice-details=...` and `cevoc.providers.evidence-images=...` as in docs/DIRECT-API-ROUTE.md section 2.
- Flow (from the structure-only network map in docs/DIRECT-API-ROUTE.md): token call (notice number in the `pnnum` header, JSON body with the offence date) -> summary, services and notifications calls with the `authorization` and `pnnum` headers -> a second token call adding the registration -> image list from the summary identifiers -> image calls with `size=thumbnail|medium|full`. Always send the newest `authorization` value the server returns.
- Step trace: the shared vocabulary; browser-only steps report `not-supported`. Cause tokens as today, plus `blocked-401`, `blocked-403`, `blocked-429`, `captcha`, `timeout`, `bad-shape`.
- Rules: a 401, 403, 429 or captcha stops the lookup with that cause token, with no retry and no workaround; every call has a connect and a read timeout; bounded retry (at most 2, with back-off) only for a timeout on the summary call (it hung in 2 of 4 live runs); the polite minimum gap between calls; the honest identifying User-Agent; the registration is request-scoped and never logged, cached or put in a key.
- Mapping: summary fields (`offence.desc`, `.date`, `.time`, `.demerit.points`, `.amount`, `.location.street/suburb`, `payment.outstanding.amount`, `images.count`, `images.identifiers`, `images.cameraCertification.ref`) fill `NoticeDetails`; anything else returned goes to `details`. Image bytes go through the existing `MediaStoragePort`; `capturePath` is `API_ORIGINAL` only when the full-size call is proven to return the camera original.
- Contract tests: a fake transport with canned fictitious JSON; the same shared tests as the Chromium route (found with images, found without plate, wrong plate, no match, 401/403/429 stop, timeout and retry bound, nothing sensitive in logs or trace). No live calls in tests.

## Open questions to settle by live rounds (all UNTESTED as of this record)
| Question | Known from the Chromium network map | Status |
|---|---|---|
| URL prefix segment: meaning and stability | one constant-looking segment, same in every call and run | UNTESTED across days; do not hard-code until confirmed, keep it in configuration |
| Exact `authorization` format | not `Bearer`/`Basic`; bare token or custom scheme | UNTESTED |
| Does the server reject non-browser callers by origin or User-Agent | no cookies, no CSRF header, no signed parameters seen; `origin` and `referer` are sent by the page | UNTESTED |
| Is `size=full` the camera original | about 1.4 MB plain JPEG; pixel size not yet read on a successful run | UNTESTED |
| Wrong-notice and wrong-registration responses | not observed | UNTESTED |
Rules for the live rounds: only the approved host, the polite gap, stop on 401/403/429/captcha and report the cause token and step, record structure only (statuses, header names, key names, sizes), never values.

## Basint certificates page as a plain HTTP route: feasibility only
Already in the code as the provider `search-page-http` (`SearchPageHttpCertificateSource`): GET the page, read the JSF hidden state fields, POST the search form, parse the results table; tested offline against fictitious fixtures, not in the default order, never run against the real site. INFERRED feasibility: likely workable for a plain JSF form (the state value is in the page), with two risks that only a live round can settle: whether the server checks the caller (User-Agent, session cookie, referer) and whether the PrimeFaces form needs an AJAX call rather than a full POST. Not built further; no decision requested.

## Comparison of the three routes
| | Chromium scraper | Plain HTTP (Revenue NSW JSON) | API providers (TfNSW) |
|---|---|---|---|
| Speed | slowest: starts a browser, loads the page shell, Cloudflare scripts; the live check takes tens of seconds (PROVEN from the 2026-11-03 runs, about 47 s for a whole run) | expected seconds (INFERRED: a handful of JSON calls) | expected fastest (INFERRED) |
| Image size | what the page requests; full size about 1.4 MB seen (PROVEN, network map) | the same `size=full` call | to be defined |
| Fragility | high: selectors, page flow, Cloudflare, summary call hung in 2 of 4 runs | medium: undocumented API, token and prefix may change | lowest (a contract) |
| Needs | Chromium in the image (large image, 2 CPU / 4 GiB live setting), approval to automate | JVM only; approval for api.osr.nsw.gov.au (given); timeouts and retry | an agreed API, credentials, network path, owner approval per source |
| Status | working, prototype only | designed, not built | reserved |
Labels: speed and fragility rows for the second and third columns are INFERRED.

## Ruled out
Replacing the Chromium route; changing the default now; working around a refusal.
