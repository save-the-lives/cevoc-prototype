# 0010. Three selectable routes per information type

Status: ACCEPTED as direction by the owner (voice, 2026-11-05). The plain HTTP adapter is BUILT (2026-11-05, branch feat/http-adapter) and tested offline with a fake transport and invented fixtures. It has NOT been run against the live service; every item labelled UNTESTED below must be filled in by a live run.
Date recorded: 2026-11-05
Owner approval: given by voice 2026-11-05 (default does not change until the owner says so)

## Decision
For each information type the provider is chosen in configuration, from three kinds of route behind the same port:
1. Chromium scraper (prototype only, today's route; stays fully working).
2. Plain HTTP adapter for the Revenue NSW JSON service (api.osr.nsw.gov.au, approved 2026-11-04): no browser.
3. API providers (TfNSW or others), reserved.
Switching is a configuration change (`cevoc.penalty-lookup.adapter=stub|browser|http`, renamed by record 0020 from `manifest|stub|scraper-evidence|revenue-nsw-http`). The default stays as today until the owner says otherwise. All three return the same canonical result (including the `details` map, record 0009), the same redacted step trace and cause tokens, and pass the same fixture-based contract tests.

## Plain HTTP adapter: design (as built; deviations listed under "Built, and where it differs from the design")
- Package: `adapter.out.revenuensw` (all Revenue NSW URLs, header names and JSON field names live there; removal later is deletion). Provider id `revenue-nsw-http`; config `cevoc.providers.notice-details=...` and `cevoc.providers.evidence-images=...` as in docs/DIRECT-API-ROUTE.md section 2.
- Flow (from the structure-only network map in docs/DIRECT-API-ROUTE.md): token call (notice number in the `pnnum` header, JSON body with the offence date) -> summary, services and notifications calls with the `authorization` and `pnnum` headers -> a second token call adding the registration -> image list from the summary identifiers -> image calls with `size=thumbnail|medium|full`. Always send the newest `authorization` value the server returns.
- Step trace: the shared vocabulary; browser-only steps report `not-supported`. Cause tokens as today, plus `blocked-401`, `blocked-403`, `blocked-429`, `captcha`, `timeout`, `bad-shape`.
- Rules: a 401, 403, 429 or captcha stops the lookup with that cause token, with no retry and no workaround; every call has a connect and a read timeout; bounded retry (at most 2, with back-off) only for a timeout on the summary call (it hung in 2 of 4 live runs); the polite minimum gap between calls; the honest identifying User-Agent; the registration is request-scoped and never logged, cached or put in a key.
- Mapping: summary fields (`offence.desc`, `.date`, `.time`, `.demerit.points`, `.amount`, `.location.street/suburb`, `payment.outstanding.amount`, `images.count`, `images.identifiers`, `images.cameraCertification.ref`) fill `NoticeDetails`; anything else returned goes to `details`. Image bytes go through the existing `MediaStoragePort`; `capturePath` is `API_ORIGINAL` only when the full-size call is proven to return the camera original.
- Contract tests: a fake transport with canned fictitious JSON; the same shared tests as the Chromium route (found with images, found without plate, wrong plate, no match, 401/403/429 stop, timeout and retry bound, nothing sensitive in logs or trace). No live calls in tests.

## Built, and where it differs from the design
Built: `adapter.out.revenuensw` (`RevenueNswHttpLookupAdapter`, `RevenueNswSummaryMapper` for all JSON field names, `HttpTransport` with a JDK implementation, `RevenueNswHttpSettings`, `RevenueNswHttpFactory`); selected by `cevoc.penalty-lookup.adapter=http` (was `revenue-nsw-http`; record 0020); wired in `BeanConfig` (which also picks the in-memory media adapter for this route when `cevoc.media.adapter` is unset). Two new cause tokens: `bad-shape` and `not-supported`. Details, settings and rules: docs/ARCHITECTURE.md ("Three selectable routes").
How to select (off unless selected): `cevoc.penalty-lookup.adapter=http` (the old `cevoc.revenue-nsw-http.enabled` is retired), `cevoc.revenue-nsw-http.base-url=https://api.osr.nsw.gov.au`, `.path-prefix=<the constant segment, from configuration>`, `.contact`, `.approval-reference` (env `CEVOC_REVENUE_NSW_HTTP_*`). Without every one of them a lookup returns `LIVE_LOOKUP_OFF` and makes no call.
Differences from the design:
- The `services` and `notifications` calls are not made (the summary carries the notifications; "plate required" is read from the image count and the absence of a registration). One call fewer to a service we do not own.
- The path prefix is a required setting, not a constant in the code. The `authorization` scheme (`.authorization-scheme`, empty = bare token) and the date format of `offenceDate` in the token body (`.offence-date-format`, default `yyyy-MM-dd`) are settings because neither is known.
- No `origin` or `referer` header is sent, on purpose: the route identifies itself honestly and does not imitate the page. If the service rejects that, the cause token will say `blocked-403` and the lookup stops; nothing is added to work around it without a new owner decision.
- Only `size=full` is fetched and stored; the smaller copies are made by the existing media endpoint, as for the Chromium route. `capturePath` is `RESPONSE` (the unchanged response body), never claimed as the camera original.
- Pacing default is 1 second between calls (floor 500 ms), not the browser route's 5 seconds, because these are small JSON calls; the owner can raise it.
- Token acquisition is exactly what the public page does for an anonymous visitor (notice number and offence date, no credentials). Nothing here obtains a token any other way, replays one, or bypasses a refusal.
Not built: `cevoc.providers.<concern>` ordered lists for notice details and evidence images (the single adapter switch is used); a result cache; the `services` call.

How to test it live (nothing has been run; the owner or the live-check agent does this): the existing `Live check run` workflow calls the deployed app's `/live-check/lookup`, which goes through whichever lookup adapter the deployed app is configured with, so it can exercise this route without a workflow change once the deployed app's environment holds `CEVOC_PENALTY_LOOKUP_ADAPTER=http` and the `CEVOC_REVENUE_NSW_HTTP_*` settings above (an Azure environment change, not made here) plus the existing live-check switches. The summary then prints the step trace; browser steps show `not-supported`. Report only the cause token, the step, the HTTP status class and counts. Alternative without Azure: run the backend locally with the same environment and the loopback live-check endpoint.

## Open questions to settle by live rounds (all UNTESTED as of this record)
| Question | Known from the Chromium network map | Status |
|---|---|---|
| URL prefix segment: meaning and stability | one constant-looking segment, same in every call and run | UNTESTED across days; do not hard-code until confirmed, keep it in configuration |
| Exact `authorization` format | not `Bearer`/`Basic`; bare token or custom scheme | UNTESTED |
| Does the server reject non-browser callers by origin or User-Agent | no cookies, no CSRF header, no signed parameters seen; `origin` and `referer` are sent by the page | UNTESTED |
| Is `size=full` the camera original | about 1.4 MB plain JPEG; pixel size not yet read on a successful run | UNTESTED |
| Wrong-notice and wrong-registration responses | not observed | UNTESTED. The adapter treats HTTP 400, 404 or 422 on the token call, or `credentials.offenceDate=false`, as no match, and 400, 404, 422 or `credentials.vehicleRego=false` on the second token call as registration not accepted. A 401 or 403 for a wrong registration would be reported as blocked, which would be wrong |
| Format of `offenceDate` in the token body | typed `string(date)` only | UNTESTED (default `yyyy-MM-dd`, setting `offence-date-format`) |
| Does the service accept a caller that sends no `origin`/`referer` | the page sends both | UNTESTED |
| Value of the path prefix | one constant segment | UNTESTED; supplied by configuration, not in the repo |
| Lifetime of the token and whether an older one keeps working after rotation | not observed | UNTESTED (the adapter always sends the newest) |
Rules for the live rounds: only the approved host, the polite gap, stop on 401/403/429/captcha and report the cause token and step, record structure only (statuses, header names, key names, sizes), never values.

## Basint certificates page as a plain HTTP route: feasibility only
Already in the code as the provider `http` (earlier `search-page-http`) (`SearchPageHttpCertificateSource`): GET the page, read the JSF hidden state fields, POST the search form, parse the results table; tested offline against fictitious fixtures, not in the default order, never run against the real site. INFERRED feasibility: likely workable for a plain JSF form (the state value is in the page), with two risks that only a live round can settle: whether the server checks the caller (User-Agent, session cookie, referer) and whether the PrimeFaces form needs an AJAX call rather than a full POST. Not built further; no decision requested.

## Comparison of the three routes
| | Chromium scraper | Plain HTTP (Revenue NSW JSON) | API providers (TfNSW) |
|---|---|---|---|
| Fragility | high: selectors, page flow, Cloudflare scripts; the summary call hung in 2 of 4 live runs (PROVEN) | medium: undocumented API; path prefix, token format and date format may change; one class holds the field names (INFERRED) | lowest: a contract (INFERRED) |
| Image size | large: Chromium and its libraries are in the image, which is why the live image is big (PROVEN, record 0004 and the Dockerfile) | JVM only, no browser layers: the image would be the plain app image (INFERRED; not measured here) | JVM only (INFERRED) |
| Deploy time | slower: a large image whose big layers are low in the Dockerfile so later deploys fetch the top layer only (PROVEN from the 2026-11-03 work) | as the default app image (INFERRED; not measured here) | as the default app image (INFERRED) |
| Speed per lookup | slowest: starts a browser, loads the page shell and scripts; about 47 s for a whole live run on 2026-11-03 (PROVEN) | a handful of JSON calls plus one call per image at a 1 s gap: expected seconds (INFERRED; not measured) | expected fastest (INFERRED) |
| Memory and CPU | 2 CPU / 4 GiB live setting (PROVEN) | ordinary JVM settings (INFERRED) | ordinary JVM settings (INFERRED) |
| Needs | Chromium in the image, `live-browser` build profile, approval to automate | JVM only; approval for api.osr.nsw.gov.au (given 2026-11-04); path prefix, contact and approval reference in configuration; timeouts and bounded retry (built) | an agreed API, credentials, network path, owner approval per source |
| Status | working, prototype only: PROVEN | built and tested offline; live behaviour INFERRED from a network capture and UNTESTED | reserved |
Labels: PROVEN means checked in code or a run; INFERRED means reasoned, not checked. No measurement of the plain HTTP route's speed or image size exists yet; fill the cells in after the first live run.

## Ruled out
Replacing the Chromium route; changing the default now; working around a refusal.
