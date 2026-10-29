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

## Environment variables
- `CEVOC_CORS_ALLOWED_ORIGINS`: front end origins allowed to call `/api`.
- `AZURE_STORAGE_CONNECTION_STRING`: only with `cevoc.media.adapter=azure-blob`.
- `CEVOC_SCRAPER_CERTIFICATES_ENABLED` (default `false`): enables the enforcement-centre certificates page scraper. The source's robots.txt disallows automated access, so production use needs the owner's approval (also set `cevoc.scraper.certificates.approval-reference`) and it should be replaced by the real API. See `docs/ARCHITECTURE.md`.
