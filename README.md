# CEVOC

Camera-fine evidence for motorists: see the images, video and camera certificates behind a notice before deciding whether to go to court.

| Folder | What it is |
|---|---|
| `frontend/` | Customer-facing React app (public, no login) |
| `backend/` | Spring Boot API, hexagonal (ports and adapters) |
| `prototype/` | The original clickable prototype (demo hub, public site, staff workspace). Still published to GitHub Pages at the same URL |
| `docs/` | Architecture notes |

## Run
    cd backend && mvn spring-boot:run     # http://127.0.0.1:8080
    cd frontend && npm install && npm run dev   # http://127.0.0.1:5174 (proxies /api to the backend)

## Environment variables (optional)
| Variable | Default | Meaning |
|---|---|---|
| `CEVOC_CORS_ALLOWED_ORIGINS` | published front end | Origins allowed to call `/api` |
| `AZURE_STORAGE_CONNECTION_STRING` | none | Only with `cevoc.media.adapter=azure-blob` |
| `CEVOC_SCRAPER_EVIDENCE_ENABLED` | `false` | Prototype Revenue NSW page scraper. Also needs `cevoc.penalty-lookup.adapter=scraper-evidence`, a base URL and a contact. **Production use needs the site owner's approval and should be replaced by the real API.** See `docs/ARCHITECTURE.md` |
| `CEVOC_SCRAPER_EVIDENCE_BASE_URL`, `CEVOC_SCRAPER_EVIDENCE_CONTACT` | none | Scraper target (https) and the contact put in its User-Agent |

## Public URLs
`https://save-the-lives.github.io/cevoc-prototype` is the published prototype. It is built from `prototype/` by `.github/workflows/deploy.yml` and its URL must not change.

See `docs/ARCHITECTURE.md`.

## Test notice numbers (fictitious, any past offence date)

| Number | Shows |
|---|---|
| 9000000001 | Speed camera: images, video, certificate |
| 9000000002 | Officer-issued caution: no evidence, no certificate |
| 9000000003 | Camera-based: one image and certificate |
| 9000000004 | Red-light camera: two images and certificate, no video |
| any other number | Friendly "live lookup is switched off until approvals are in place" message |
| starts with X | No match |
| X1234 | Not found |
