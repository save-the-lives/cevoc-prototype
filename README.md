# CEVOC

Camera-fine evidence for motorists: see the images, video and camera certificates behind a notice before deciding whether to go to court.

| Folder | What it is |
|---|---|
| `frontend/` | Customer-facing React app (public, no login) |
| `backend/` | Spring Boot API, hexagonal (ports and adapters) |
| `prototype/` | The original clickable mockup (demo hub, public site, staff workspace). Still published to GitHub Pages at the same URL |
| `docs/` | Architecture notes; start with `docs/HANDOVER.md` |

## Run
    cd backend && CEVOC_PENALTY_LOOKUP_ADAPTER=stub CEVOC_CERTIFICATES_PROVIDERS=none mvn spring-boot:run     # http://127.0.0.1:8080 (fictitious data, nothing contacted)
    cd frontend && npm install && npm run dev   # http://127.0.0.1:5174 (proxies /api to the backend)

## Environment variables (optional)
| Variable | Default | Meaning |
|---|---|---|
| `CEVOC_CORS_ALLOWED_ORIGINS` | published front end | Origins allowed to call `/api` |
| `AZURE_STORAGE_CONNECTION_STRING` | none | Only with `cevoc.media.adapter=azure-blob` |
| `CEVOC_SCRAPER_EVIDENCE_CONTACT` | none, **required** | The contact put in the User-Agent of the real lookup. Without it the app starts, logs one clear error line, and lookups answer "not available". The only variable the deployment must set |
| `CEVOC_PENALTY_LOOKUP_ADAPTER` | `browser` | Optional override of the one setting that picks the lookup route: `browser` (default, temporary Chromium route to the Revenue NSW page), `stub` (explicit: fictitious data, nothing contacted), `http` (plain request route), `api` (reserved). See `docs/ARCHITECTURE.md` and record 0022 |
| `CEVOC_SCRAPER_EVIDENCE_URL` | the Revenue NSW login page | Optional override: one fully qualified https login page address |

## Public URLs
`https://save-the-lives.github.io/cevoc-prototype` is the published original mockup. It is built from `prototype/` by `.github/workflows/deploy.yml` and its URL must not change.

See `docs/ARCHITECTURE.md` (the standing architecture document) and `docs/decisions/` (one record per architectural decision).

## Test notice numbers (fictitious, any past offence date)

Frontend: when the lookup response has a non-empty `certificates` array (`description`, `type`, `periodText`, `certifiedDate`, `expiryDate`, `coversOffence`), the result page shows a "Camera certificates" list. Covering rows are badged "In force on the offence date", others "Not in force on the offence date". The server sends only the certificates that bear on the offence (the one in force, or the two either side of a gap) with a `certificateCoverage` summary, and the page shows that message under "Was the camera working properly?". Without a list, the older certificate display is used. In `?mock=1` dev mode, 9000000001 returns one fictitious covering row.

| Number | Shows |
|---|---|
| 9000000001 | Speed camera: images, video, certificate |
| 9000000002 | Officer-issued caution: no evidence, no certificate |
| 9000000003 | Camera-based: one image and certificate |
| 9000000004 | Red-light camera: two images and certificate, no video |
| any other number | "Live lookup against the source sites is switched off until approvals are in place." (status LIVE_LOOKUP_DISABLED; the `stub` adapter, which you select explicitly with `CEVOC_PENALTY_LOOKUP_ADAPTER=stub`) |
| starts with X | No match (NOT_FOUND) |
| X1234 | Not found |

## Environment variables
- `CEVOC_CORS_ALLOWED_ORIGINS`: front end origins allowed to call `/api`.
- `AZURE_STORAGE_CONNECTION_STRING`: only with `cevoc.media.adapter=azure-blob`.
- `CEVOC_CERTIFICATES_PROVIDERS` (optional override, default `browser`; `none` = no certificate source): the certificates adapter choice, an ordered list using the same names as the lookup adapter (`http`, `browser`, `api`). The source's robots.txt disallows automated access, so production use needs the owner's approval and it should be replaced by the real API. See `docs/ARCHITECTURE.md` and `docs/CONFIG-REFERENCE.md`.
