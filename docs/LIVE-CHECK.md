# Live check (owner-run)

A one-off way for the owner to see what the evidence scraper makes of the real myPenalty pages, using their own notice, on their own machine. Nothing here runs in CI, in the Docker image or by default. All scrapers stay OFF unless this script turns them on for one run.

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
| `LIVE_BASE_URL` | https URL of the site (origin, or the full login URL) |
| `LIVE_CONTACT` | your contact, put in the User-Agent so the site owner can reach you |
| `I_HAVE_APPROVAL` | must be `yes`: you have approval to make these automated requests (robots.txt disallows them otherwise) |
| `SAVE_HTML` | `yes` saves the raw rendered HTML of each step to `live-capture/` |
| `LIVE_HEADED` | `1` shows the browser window |
| `LIVE_MIN_INTERVAL_MS` | pause between site requests (default 5000, minimum 3000) |
| `LIVE_CERT_APPROVAL_REF` | also run the certificate lookup (needs your approval reference) |

Never put these values in a file, in the repo, or in a command line you keep in shell history. If you pre-set them, use `read -s` or a password manager, not `export NOTICE=...` in a saved script.

## What it does

1. Starts the backend on `127.0.0.1` only, with `-Plive-browser`, `cevoc.penalty-lookup.adapter=scraper-evidence`, `cevoc.scraper.enabled=true`, `cevoc.scraper.evidence.enabled=true` and `cevoc.scraper.evidence.browser=playwright`.
2. Sends ONE lookup to `POST /live-check/lookup` (loopback, only present with that profile and `cevoc.live-check.enabled=true`). The plate travels in that request body and is held in a thread-local for that single call (`RequestScopedRegistration`); it is not on the public API, not logged, not cached, not stored.
3. The browser opens the login page, fills `pnn` and `dateOfOffence`, clicks Next, waits for the summary, and (with a registration) fills `vehicleNumber`, clicks "View images" and waits for the thumbnails. Images are read inside the page and only counted; the default stub media adapter stores nothing.
4. Prints a redacted summary and stops the backend.

## From your phone, on the Azure app (no Mac)

The deployed app can run the same check. It is OFF unless you switch it on below; the normal deploy is unchanged and has no browser.

1. On github.com open the repo, Settings > Secrets and variables > Actions.
2. Under Variables add: `LIVE_CHECK_ENABLED` = `true`, `CEVOC_BASE_URL` = the https address of the site (origin or login URL), `LIVE_CONTACT` = how the site owner can reach you.
3. Under Secrets add `LIVE_CHECK_TOKEN` = a long random string only you know (a password manager can make one). It is never printed; the app keeps it as a Container App secret.
4. Actions tab > "Trigger auto deployment for cevoc-backend" > Run workflow (branch: the one holding this code, or main once merged). Wait for the green tick; the last step checks `/live-check/ping`.
5. Call the app with your token, for example from a phone shortcut or a REST app: `POST https://<app-fqdn>/live-check/lookup` with header `X-Live-Check-Token: <token>`, header `Content-Type: application/json` and body `{"notice":"...","offenceDate":"YYYY-MM-DD","registration":"optional"}`. You get the redacted summary back (see Output). `GET /live-check/ping` answers `ok`.

Rules enforced by the app: every `/live-check/*` call needs the token header (wrong or missing is 401; no token configured means the endpoints answer 404); one lookup runs at a time (a second gets 429); nothing you send is logged or echoed. Only the existing front-end origin may call it from a browser.

Turn it off: set `LIVE_CHECK_ENABLED` to `false` (or delete it), re-run the same workflow. That redeploys the normal image with all scraper switches false, clears the token and settings from the app, and resets the size to 0.5 CPU / 1 GiB. Do this when you are done.

Cost and memory: the live image is bigger (it contains Chromium) and runs at 2 CPU / 4 GiB with one always-on replica, roughly four times the normal size, so it costs more every hour it is left on. Chromium needs the memory; at 1 GiB it would be killed. The Docker build of this image is also checked by App CI on every change.

Fictitious values only in the repo: the notice, date and plate are typed or sent by you at run time and are never stored.

## Output

Yes/no and counts only: state reached (1 login, 2 summary, 3 images, or failed), which notice fields were found, number of images, whether a camera code was found, and the certificate count. It never prints the notice number, plate, dates, amounts, location or camera code. Backend console output goes to `live-capture/backend.log` (class names of failures only).

## Saved HTML

With `SAVE_HTML=yes`, `live-capture/<time>-1-login.html`, `-2-after-login.html`, `-3-after-plate.html` hold the raw rendered DOM. They can contain real data (the state 3 page shows the plate and the notice). The folder is gitignored and owner-only. To get the selectors tuned, send redacted copies: replace the notice number, dates, amounts, location, plate, camera code, image refs and any `m=` value, and keep the markup. Delete the folder when done.

## Limits

- It cannot be verified from the build servers: they cannot reach the site, so the selectors (inferred, not seen) are first guesses. Expect to tune them from the saved HTML.
- A wrong or unmatched notice is detected only as "still on the login page" or a visible error; the real wording is unknown.
- If your network needs a proxy for Chromium, it is not configured here.

## For developers

The `LiveCheckGuard` interceptor (default build, active only when `cevoc.live-check.enabled=true`) holds the token check, the one-at-a-time limit and the 404-when-no-token rule; env names: `CEVOC_LIVECHECK_ENABLED`, `CEVOC_LIVECHECK_TOKEN`. Docker: `docker build --build-arg LIVE_BROWSER=true backend`.

Source set `backend/src/live/java` (Playwright session and factory, the local-check endpoint) is added by `build-helper-maven-plugin` only under `-Plive-browser`. `ScraperEvidenceFactory` loads the factory by name, so the default build has no Playwright reference. CI runs `mvn test` (default build, with unit tests for the profile-free parts) and a compile-and-test job with `-Plive-browser` that launches no browser.
