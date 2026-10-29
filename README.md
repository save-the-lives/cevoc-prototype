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
