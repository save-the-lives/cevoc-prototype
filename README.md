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

## Live lookup switches (off by default)

Settable as Azure Container App environment variables, no code change: `CEVOC_EVIDENCE_SCRAPER_ENABLED`,
`CEVOC_CERTIFICATE_SCRAPER_ENABLED` (both `false`) and `CEVOC_PENALTY_LOOKUP_ADAPTER` (`stub`). The scraper
adapters are not built yet; see docs/ARCHITECTURE.md. Do not set them to true until approval is obtained.
