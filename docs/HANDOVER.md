# Handover: start here

For developers taking this code over. It describes the system as it stands, not as a finished product: some parts are temporary and are listed in one place below so none of them is mistaken for the intended design.

## Start here (reading order)
1. This file.
2. `docs/ARCHITECTURE.md` (standing architecture document; the table at the top is the summary).
3. `docs/decisions/README.md`, then records 0001, 0002, 0003, 0004, 0010 and 0020 (structure, cloud, interim provider, temporary routes, adapter selection).
4. `docs/CONFIG-REFERENCE.md` (every setting: name, default, scope, status).
5. `docs/DEPLOY-AZURE.md` and `docs/RUNBOOK-AWS.md` (how it is deployed today and the target).
6. `docs/DEMO-DATA.md` and `docs/LIVE-CHECK.md` only when you touch demo data or the temporary live route.
7. `docs/UI-AUDIT.md` once it is merged (see Known gaps).

## What the system does
A public, no-login web app for motorists. A person enters a penalty notice number and offence date (and, where needed, a vehicle registration) and sees the evidence behind a camera fine: images, video and the camera certificates that cover the offence time, so they can decide whether to go to court. Data comes from a source behind a port. Today that source is either bundled fictitious data (default) or an interim route to Revenue NSW pages; the TfNSW APIs are meant to replace the interim routes by configuration.

## Run locally
    cd backend && mvn spring-boot:run             # http://127.0.0.1:8080
    cd frontend && npm install && npm run dev     # http://127.0.0.1:5174, proxies /api to the backend
    cd frontend && npm test && npm run build      # front end tests and build

With no settings the backend uses the `stub` adapter: bundled fictitious notices (test numbers are in `README.md`), nothing external is contacted. `mvn test` in `backend/` runs the backend tests (CI installs `tesseract-ocr` because the banner OCR tests must run there).

## Architecture in one page
- Backend: Spring Boot, hexagonal (ports and adapters). `domain/` and `application/` hold the rules and the ports (for example `PenaltyLookupPort`, `CertificateSourcePort`, `MediaStoragePort`, `BannerTextReaderPort`); no cloud or scraper type may appear there. `ArchitectureTest` enforces the direction. `adapter/in/web` is the HTTP API; `adapter/out/*` are the sources and stores (`stub`/manifest, `scraper`, `revenuensw`, `demo`, `httpbundle`, `memory`, `azureblob`, `s3` placeholder, `ocr`). `config/BeanConfig` wires them.
- Adapter selector settings (one setting per concern, no per-route on/off switches, record 0020):
  - `cevoc.penalty-lookup.adapter` (env `CEVOC_PENALTY_LOOKUP_ADAPTER`): `stub` (default), `browser`, `http`, `api` (reserved; selecting it stops start-up).
  - `cevoc.certificates.providers`: ordered list, default empty (none); `browser`, `http`, `api` (reserved), plus legacy names.
  - `cevoc.media.adapter`: `stub`, `memory` or `azure-blob` (unset: `memory` when the lookup adapter is `browser` or `http`, else `stub`).
  - Demo data is its own single switch, `CEVOC_DEMO_DATA_ENABLED=true`; banner OCR is `CEVOC_BANNER_OCR_ENABLED`.
- Front end: React (Vite) in `frontend/`. Program-by-program display switches live in the front end config (records 0007, 0013 to 0016); only red light is built.
- `prototype/` is the original clickable mockup, published to GitHub Pages. It is not part of the app and is not deployed with it. Its URL must not change (record 0006).

## Configuration
All settings, defaults and their scope (Temporary, Production, Both) are in `docs/CONFIG-REFERENCE.md`. Any property can be set by an environment variable (upper case, dots and dashes to underscores). Secrets are never committed.

## Deploys today
- Azure (trial subscription, Australia East). Backend: `.github/workflows/cevoc-backend-AutoDeployTrigger-*.yml` builds the image on the GitHub runner, pushes it to `ghcr.io/<owner>/cevoc-backend` and updates the Container App (replicas pinned at 1). Front end: `azure-static-web-apps-*.yml` to Static Web Apps. CI is `app-ci.yml`. Details in `docs/DEPLOY-AZURE.md`.
- GitHub Pages serves the original mockup (`deploy.yml`).
- AWS is the real target and is a draft: `docs/RUNBOOK-AWS.md` maps each Azure piece to AWS and lists what changes (an S3 media adapter, an AWS deploy workflow, CloudFront routing of `/api`). Domain and application code do not change.

## Temporary parts (temporary: delete at cutover)
Everything below is scheduled for removal when the TfNSW API providers exist (`api` value of the selectors). Nothing in production code may depend on them. The authoritative delete lists are in `docs/ARCHITECTURE.md` ("Certificate providers") and `docs/CONFIG-REFERENCE.md` (Scope = Temporary).

| Part | Where | Why it is temporary |
|---|---|---|
| Chromium/Playwright browser route (lookup adapter `browser`, certificate provider `browser`, legacy `browser-link`) | `backend/src/live/` (Playwright session and factory, network map, HTML capture), `adapter/out/scraper` (evidence adapter, `RenderedPageSession*`, `SearchPageCertificateSource`, `BrowserCertificateSourceAdapter`, `CertificateHandoff`), `live-browser` profile in `pom.xml`, Chromium layers in `backend/Dockerfile` | The source pages have no API and render with scripts, so a browser is the only way to read them today (record 0004). Needs the site owner's approval for any real use; robots.txt disallows automated access. |
| Live-check endpoints, guard and workflow | `/live-check/*`, `backend/.../livecheck`, `LiveCheckController` in `src/live`, `frontend/src/LiveCheck.jsx`, `scripts/live-check.sh`, `.github/workflows/live-check-run.yml`, live-check parts of the backend deploy workflow, `CEVOC_LIVECHECK_ENABLED` | Owner-run diagnostics for the browser route only. Endpoints are open while enabled, so off by default (`docs/LIVE-CHECK.md`). |
| Plain HTTP scraper route (lookup adapter `http`; certificate provider `http`, legacy `http-form`) | `adapter/out/revenuensw` (whole package), `SearchPageHttpCertificateSource` and related certificate scraper classes | Interim access to the Revenue NSW JSON service and certificates page; built and tested offline, never run live. Replaced by the API providers (record 0010). |
| In-memory media store | `adapter/out/memory/InMemoryMediaAdapter`, `CEVOC_MEDIA_MEMORY_*`, `CEVOC_MEDIA_PUBLIC_BASE_URL` | Holds scraped evidence bytes for 20 minutes in one process; a restart drops everything and it cannot be shared between replicas. Replaced by a shared store (`azure-blob` now, `s3` on AWS). |
| Demo data and demo hub | `adapter/out/demo`, `adapter/out/httpbundle`, `DemoDataConfig`, `DemoCaseFactory`, `/demo-cases`, `frontend/src/DemoHub.jsx`, `DemoBanner.jsx`, `demoHub.js`, `scripts/build-demo-bundle.mjs`, `.github/workflows/demo-bundle.yml`, `CEVOC_DEMO_*` (`docs/DEMO-DATA.md`) | Fictitious notices for demonstration only. Off by default; must be off before real sources are connected. |
| Stub adapter and bundled sample content | `adapter/out/stub`, `ManifestPenaltyLookupAdapter`, `ManifestFirstPenaltyLookupAdapter`, `backend/src/main/resources/manifest.json`, `frontend/public/samples/`, `frontend/src/mock.js` | Fictitious notices and sample media used while no real source is connected. Keep for tests and local runs if wanted; remove from the deployed default at cutover. |
| Banner OCR reader | `adapter/out/ocr/TesseractBannerTextReader`, `BannerTextReaderPort`, Tesseract in the image, `CEVOC_BANNER_OCR_*` (record 0019) | Reads time-since-red and speed limit from the picture's pixels because the current source does not give them as data. Delete if the direct source provides these fields. |
| Interim wording and banners | "Interim service" footer, "Demonstration data only." banner and summary | Say what the app is today; revisit when real sources are connected. |
| Approval reference note | `CEVOC_CERTIFICATES_APPROVAL_REFERENCE`, `CEVOC_REVENUE_NSW_HTTP_APPROVAL_REFERENCE` | Recorded note for the interim routes; goes with them. |

## Open decisions
- Which AWS shape (ECS Fargate or App Runner; CloudFront signed URLs or S3 pre-signed URLs), and whether it sits in an agency landing zone (`docs/RUNBOOK-AWS.md`).
- Repository and Pages site naming (the repository is still `save-the-lives/cevoc-prototype`; renaming is the owner's call and affects record 0006).
- Privacy blurring of evidence media (record 0017, research only, nothing built); evidence pack download (0011); road safety message engine (0012, 0016).
- Per-program configuration beyond red light (0007, 0013 to 0016).
- Static Web Apps region and data residency (`docs/DEPLOY-AZURE.md`).

## Known gaps
- The certificates search host does not resolve from Azure, so the certificate providers cannot run from the current Azure deployment.
- Evidence image 2 is genuinely small at source; this is not a rendering bug.
- Backend replicas must stay at 1 until a shared media store exists (the in-memory store is per process).
- The `http` route and the real page field ids for the certificates form are untested against the live services (`INFERRED` in the docs).
- UI audit is pending: see `docs/UI-AUDIT.md` once it is merged.
- Azure deploy docs were written before an account was connected and are a checklist; the AWS runbook is untested.
