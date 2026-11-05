# Visual check of the result page

A repeatable way to see the result page (and compare it with the original clickable mockup in `prototype/`) without the backend, the live sites or any network. All data is invented.

## Run
    cd frontend && npm ci && cd ..          # once
    cd prototype && npm ci && cd ..         # once, optional: adds the mockup's red light page
    node scripts/visual-check.mjs           # screenshots and report in visual-check-output/ (git-ignored)

Options: `--out DIR` (or `VISUAL_OUT`), `--skip-mockup`, `--no-build` (reuse the previous build), `--only a,c2` (case ids or their letter prefix). It needs Chromium through Playwright (already a dev dependency of `frontend/`; locally, `npx playwright install chromium` in `frontend/` if you have none).

## What it does
1. Builds the front end and serves it on 127.0.0.1 together with a tiny mock of the API (`POST /api/penalty-lookups/stream`, same events as the backend: details, evidence, extra, certificates, done or error) and invented SVG photos. The date is fixed to 5 Nov 2026 so the screenshots do not drift.
2. Fills in the form and takes full-page screenshots at 390 px (mobile) and 1280 px (desktop), device scale factor 2, for each case:
   - a: red light notice with details, 3 photos, certificate present
   - b: the same without a certificate (by-design not available)
   - c: details missing the seconds-after-red fact; c2: no details at all
   - d: certificates failed technically (distinct wording from b)
   - e: a non-red-light program (speed camera)
3. Builds the mockup (if `prototype/node_modules` exists) and captures its red light page the same way.
4. Writes `report.md` and `report.json`: horizontal scroll, tap targets under 24 and 44 px, images without alt text, axe-core results (WCAG 2.2 AA, including colour contrast), and any external request it blocked. Page text is saved under `text/` for wording comparisons.

Every request outside 127.0.0.1 is blocked, so it works offline. Notice numbers 9000000101 and up exist only in this script.

## Demo hub and demo cases
Unless `--no-demo` is given, it also screenshots the demo hub (`/demo-cases`) and every listed demo case (opened the way the hub link opens it, plus a second shot after the plate for the cases that hold images back), mobile and desktop, with the same checks. The list, stream events and sample images come from `scripts/visual-check-demo-cases.json`, generated from the backend's scenario list (see `docs/DEMO-DATA.md`); `--only demo` runs just these.

## In CI
`.github/workflows/visual-check.yml` runs it on `workflow_dispatch` and on pull requests that touch `frontend/` or the script, and uploads the output folder as the `visual-check` artifact. It is separate from App CI and does not gate it.

## What it cannot show
The real backend responses, real photos, video playback, the live Revenue NSW or certificate pages, or how a real phone renders (it uses Chromium with a phone-sized viewport).
