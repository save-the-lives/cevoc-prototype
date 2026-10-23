# CEVOC React prototype (v0.2)

Clickable demonstration of the CEVOC public and authorised-officer journeys described in the CEVOC SAD.
All data and images are fictitious. Nothing connects to Transport, Revenue NSW or identity systems.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173 (bound to your machine only). Vite reloads the page as you change files.

## Sample data

| Penalty notice | Registration | Scenario |
|---|---|---|
| 3162457890 | CEV123 | Speed offence, 2 images |
| 3162457891 | RLC456 | Red-light offence, 1 withdrawn image, future video |
| 3162457892 | ERR999 | Source system unavailable |

Officer sign-in is mocked. Choose an identity to see role-based access, including a signed-in user with no CEVOC role.
Use **Prototype controls** (bottom right) to simulate an outage, show the future video capability or reset.

## Images and video

- Built-in placeholders live in `public/assets/placeholders` and are labelled SAMPLE.
- Pull sample images from the reference prototype site:
  ```bash
  npm run assets:fetch
  ```
  Files go to `public/assets/fetched` and are listed in `public/assets/manifest.json`.
  Image order maps to slots in `src/data/mockData.js`: 0–2 offence images, 3–5 camera sites.
- Videos: copy MP4 files into `public/assets/media`, then run `npm run assets:scan`.
- Brand: put an approved NSW Government logo at `public/assets/brand/nsw-government-logo.svg`. Until then a text lockup is shown.

## Structure

```
src/
  App.jsx               routes and shared prototype state
  data/mockData.js      fictitious notices, cameras, certificates, roles
  services/mockApi.js   mock API (stands in for the target services)
  services/assets.js    manifest-driven asset resolution
  components/           NSW Design System aligned UI (nsw-* classes)
  pages/                Home, Notice, Cameras, Certificate, Officer, About
scripts/fetch-assets.mjs
```

## Build

```bash
npm run build
```

Static output is written to `dist/` and uses relative paths and hash routing, so it can be served from any folder or GitHub Pages.

## Change workflow

```bash
git status --short      # what changed
git diff                # line-by-line
git apply --check x.patch && git apply x.patch   # apply a delta
git add -A && git commit -m "message"
```
