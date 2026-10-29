# Live check (owner-run, local only)

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

## Output

Yes/no and counts only: state reached (1 login, 2 summary, 3 images, or failed), which notice fields were found, number of images, whether a camera code was found, and the certificate count. It never prints the notice number, plate, dates, amounts, location or camera code. Backend console output goes to `live-capture/backend.log` (class names of failures only).

## Saved HTML

With `SAVE_HTML=yes`, `live-capture/<time>-1-login.html`, `-2-after-login.html`, `-3-after-plate.html` hold the raw rendered DOM. They can contain real data (the state 3 page shows the plate and the notice). The folder is gitignored and owner-only. To get the selectors tuned, send redacted copies: replace the notice number, dates, amounts, location, plate, camera code, image refs and any `m=` value, and keep the markup. Delete the folder when done.

## Limits

- It cannot be verified from the build servers: they cannot reach the site, so the selectors (inferred, not seen) are first guesses. Expect to tune them from the saved HTML.
- A wrong or unmatched notice is detected only as "still on the login page" or a visible error; the real wording is unknown.
- If your network needs a proxy for Chromium, it is not configured here.

## For developers

Source set `backend/src/live/java` (Playwright session and factory, the local-check endpoint) is added by `build-helper-maven-plugin` only under `-Plive-browser`. `ScraperEvidenceFactory` loads the factory by name, so the default build has no Playwright reference. CI runs `mvn test` (default build, with unit tests for the profile-free parts) and a compile-and-test job with `-Plive-browser` that launches no browser.
