# Live check (owner-run)

A one-off way for the owner to see what the evidence scraper makes of the real myPenalty pages, using their own notice, on their own machine. Nothing here runs in CI, in the Docker image or by default. Scrapers stay OFF by default simply because no scraper adapter is selected; this script selects the browser adapter for one run.

Needs: Java 21, Maven, curl, network access to Maven Central and the site. The first run downloads dependencies and a Chromium build (a few minutes).

## Run

```bash
scripts/live-check.sh
```

It asks for each value (the notice, date and registration are typed silently), or you can pre-set them in the shell:

| Variable | Meaning |
|---|---|
| `NOTICE` | penalty notice number |
| `OFFENCE_DATE` | `DD/MM/YYYY` (or `YYYY-MM-DD`) |
| `REGISTRATION` | optional; leave empty to stop at the summary step (no images) |
| `LIVE_BASE_URL` | https URL of the site: the full login page URL (an origin alone still works for now; the app completes it with the built-in path). Becomes `CEVOC_SCRAPER_EVIDENCE_URL` |
| `LIVE_CONTACT` | your contact, put in the User-Agent so the site owner can reach you |
| `I_HAVE_APPROVAL` | must be `yes`: you have approval to make these automated requests (robots.txt disallows them otherwise) |
| `SAVE_HTML` | `yes` saves the raw rendered HTML of each step to `live-capture/` |
| `LIVE_HEADED` | `1` shows the browser window |
| `LIVE_MIN_INTERVAL_MS` | pause between site requests (default 5000, minimum 3000) |
| `LIVE_CERTS` | `no` skips the certificate lookup; by default it runs through the basint search page (Chromium, prototype only) |

Never put these values in a file, in the repo, or in a command line you keep in shell history. If you pre-set them, use `read -s` or a password manager, not `export NOTICE=...` in a saved script.

## What it does

1. Starts the backend on `127.0.0.1` only, with `-Plive-browser` and `cevoc.penalty-lookup.adapter=browser` (the one adapter-selection setting; the per-route scraper switches no longer exist), plus the URL and contact.
2. Sends ONE lookup to `POST /live-check/lookup` (loopback, only present with that profile and `cevoc.live-check.enabled=true`). The plate travels in that request body and is held in a thread-local for that single call (`RequestScopedRegistration`); it is not on the public API, not logged, not cached, not stored.
3. The browser opens the login page, fills `pnn` and `dateOfOffence`, clicks Next, waits for the summary, and (with a registration) fills `vehicleNumber`, clicks "View images" and waits for the thumbnails. Images are read inside the page and only counted; the default stub media adapter stores nothing.
4. Prints a redacted summary and stops the backend.

## From your phone, on the Azure app (no Mac)

The deployed app can run the same check. It is OFF unless you switch it on below; the normal deploy is unchanged and has no browser.

1. On github.com open the repo, Settings > Secrets and variables > Actions.
2. Under Variables add: `LIVE_CHECK_ENABLED` = `true`, `CEVOC_BASE_URL` = the https address of the site (preferably the full login page URL; it becomes `CEVOC_SCRAPER_EVIDENCE_URL`), `LIVE_CONTACT` = how the site owner can reach you.
3. There is no token any more: the secret `LIVE_CHECK_TOKEN` and the setting `CEVOC_LIVECHECK_TOKEN` are retired (delete the secret if you still have it). While live check is switched on the endpoints are open, so switch it off when you are done.
4. Actions tab > "Trigger auto deployment for cevoc-backend" > Run workflow (branch: the one holding this code, or main once merged). Wait for the green tick; the last step checks `/live-check/ping`.
5. Call the app, for example from a phone shortcut or a REST app: `POST https://<app-fqdn>/live-check/lookup` with header `Content-Type: application/json` and body `{"notice":"...","offenceDate":"YYYY-MM-DD","registration":"optional"}`. You get the redacted summary back (see Output). `GET /live-check/ping` answers `ok`.

Rules enforced by the app: while `CEVOC_LIVECHECK_ENABLED` is `true` the `/live-check/*` endpoints are open (no token, no 401); when it is not `true` they do not exist and answer 404; one lookup runs at a time (a second gets 429); nothing you send is logged or echoed. Only the existing front-end origin may call it from a browser.

Turn it off: set `LIVE_CHECK_ENABLED` to `false` (or delete it), re-run the same workflow. That redeploys the normal image with the adapter back at its default (empty, which means `stub`), live check and OCR off, the evidence URL, contact and certificates adapter cleared, and resets the size to 0.5 CPU / 1 GiB. Do this when you are done.

Cost and memory: the live image is bigger (it contains Chromium) and runs at 2 CPU / 4 GiB with one always-on replica, roughly four times the normal size, so it costs more every hour it is left on. Chromium needs the memory; at 1 GiB it would be killed. The Docker build of this image is also checked by App CI on every change.

Fictitious values only in the repo: the notice, date and plate are typed or sent by you at run time and are never stored.

## Output

Yes/no and counts only: state reached (1 login, 2 summary, 3 images, or failed), which notice fields were found, number of images, whether a camera code was found, and the certificate count. Each lookup also prints a fixed-vocabulary step trace, one line per step (`step 4 read-summary : ok 820ms`; steps: start-browser, open-login, submit-login, read-summary, give-plate, view-images, capture-images, certificates; outcome ok, failed or skipped, with a whitelisted cause token on failures) and `first failed step`. For each captured image it prints pixel size, byte count and capture path (canvas, fetch or screenshot), plus the rendered and natural size of the page element (canvas capture may be thumbnail resolution; compare the two). Numbers only. The owner page `/live-check` sends `includeImages: true`, which makes the response JSON `{summary, images[]}` with the image bytes (base64) so the page can show them; the default, and the GitHub workflow, stay text-only. Responses carry `Cache-Control: no-store`; the bytes are never logged or stored by this path. It never prints the notice number, plate, dates, amounts, location or camera code. Backend console output goes to `live-capture/backend.log` (class names of failures only).

## Saved HTML

With `SAVE_HTML=yes`, `live-capture/<time>-1-login.html`, `-2-after-login.html`, `-3-after-plate.html` hold the raw rendered DOM. They can contain real data (the state 3 page shows the plate and the notice). The folder is gitignored and owner-only. To get the selectors tuned, send redacted copies: replace the notice number, dates, amounts, location, plate, camera code, image refs and any `m=` value, and keep the markup. Delete the folder when done.

## Limits

- It cannot be verified from the build servers: they cannot reach the site, so the selectors (inferred, not seen) are first guesses. Expect to tune them from the saved HTML.
- A wrong or unmatched notice is detected only as "still on the login page" or a visible error; the real wording is unknown.
- If your network needs a proxy for Chromium, it is not configured here.

## For developers

The `LiveCheckGuard` interceptor (default build, active only when `cevoc.live-check.enabled=true`) holds the one-at-a-time limit (the token check is gone); env name: `CEVOC_LIVECHECK_ENABLED`. Docker: `docker build backend` (one image, always with Chromium; the live check is switched on only by the env settings above).

Source set `backend/src/live/java` (Playwright session and factory, the local-check endpoint) is added by `build-helper-maven-plugin` only under `-Plive-browser`. `ScraperEvidenceFactory` loads the factory by name, so the default build has no Playwright reference. CI runs `mvn test` (default build, with unit tests for the profile-free parts) and a compile-and-test job with `-Plive-browser` that launches no browser.

## Network map (structure only, off by default)
Add `"networkMap": true` to the `/live-check/lookup` body (or tick `network_map` when running the "Live check run" workflow) to append `NETMAP ...` lines to the summary: every request the browser made, in order, tagged with the lookup step, as method, host, path pattern (ids, numbers, uuids and tokens replaced by `{id:mask#tag}`, `{n}`, `{uuid}`), query key names (a value only for fixed size words such as `size=full`), status, content type, request header NAMES, body shapes as key trees with value types and array lengths, image content type, size bucket and pixel size. Key names must match a strict whitelist (anything else prints `?`). No value, host-specific identifier, token, cookie, notice number, plate, date, name or page text is printed. Scripts, styles and fonts are only counted per host. The findings are in `docs/DIRECT-API-ROUTE.md`.

## Certificates step: search page (interim, approved by the owner 2026-11-04)
**PROTOTYPE-ONLY.** The browser option (this live check, the Chromium route, the `live-browser` profile, `/live-check/*`) is removed at cutover to the API providers; the delete list is in docs/ARCHITECTURE.md ("Certificate providers"). Live-mode deploys pass `CEVOC_CERTIFICATES_PROVIDERS=browser` (the certificates adapter choice, same names as the lookup adapter: `browser`, `http`, `api`; the old names `search-page` and `search-page-http` are retired). An approval reference is now an optional recorded note and is no longer set by the deploy or required. The `http` provider stays in the code, tested, but is not in the default order; the TfNSW API provider is added in front by config when it exists.

The signed certification link is no longer the default (it answers 403, also in the owner's own browser). The `certificates` step now searches the public certificates page (`searchCertificates.jsf`) with the camera code from the lookup as Location code and the offence day as Date/Time from and to, in a headless-browser session of its own, and returns the certificate rows plus whether one covers the offence. The search page is INTERIM: it is replaced by the TfNSW API provider through `cevoc.certificates.providers` when that exists (see docs/DIRECT-API-ROUTE.md). robots.txt of that page disallows automated access; the owner approved this use on 2026-11-04. Safeguards unchanged: off outside live-check deploys, the polite rate limit, the honest user agent with the contact, no live calls in tests, and a refusal (401, 403, 429) stops the attempt and shows as `cause=blocked-<status>` (a captcha as `cause=captcha`).

A second interim provider, `http`, does the same search with plain HTTP (GET the page, read the JSF hidden fields and field names, POST the form) and no browser. It can be selected by config (`cevoc.certificates.providers=http,...`). A refusal on one route stops the chain (the other route is not tried). Both routes are replaced by the TfNSW API provider later.

Output adds structure-only `srch-*` / `srch-http-*` markers to the failure detail line: status codes, which way each field was found (label, css, neighbour, order), whether the typed values stayed, the calls the page made (kind, method, status), and the structure of the form and of the result (ids and names of inputs, labels and headers from a fixed vocabulary, counts, yes/no markers). Never a typed value, a result cell or free page text. The summary line `certificates       : N (at least one covers the offence)` is the answer.

## Certificates step: known block (observed)
The certification address (a plain HTML page on a Transport for NSW host) answers 403 to the Azure headless caller, both for a fresh tab in the same browser context and for an in-page fetch, with the session cookies. The app sends the identifying user agent, a Referer of the myPenalty origin and `Accept-Language: en-AU`; it does not impersonate an ordinary browser. The step therefore reports `step=certificates; outcome=failed; cause=blocked-403` (also `blocked-401`, `blocked-429`), plus structure only: status, content type, response header names from a fixed list, and yes/no block-page markers. Needed from TfNSW: allowlisting of the app egress address for this page, or a non-scrape TfNSW source for the certificates (see `docs/ARCHITECTURE.md`, "Browser route for certificates").


## Public image path and streaming (summary lines)

Camera images captured by a live lookup are held in memory (`cevoc.media.adapter` unset means `memory` when the lookup adapter is
`browser` or `http`, otherwise `stub`) and served from `/api/media/<token>` (original, `?s=medium`, `?s=thumb`). Retention is 20 minutes
and 96 MB in total; a restart drops them and the page asks again (one replica, so no cross-replica misses). The summary ends with
`public images`, `public plate flag` and, per image and size, `HTTP status, content type, bytes, cors` (numbers only). The page reads
`POST /api/penalty-lookups/stream` (Server-Sent Events: details, evidence, certificates, done / error); the JSON endpoint is unchanged.
When the source holds images back until the registration is given and none was sent, `plateRequired` is true (yes/no, never the plate).
