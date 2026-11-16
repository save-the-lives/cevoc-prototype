# 0031. One container serves the site and the API; no CORS; Front Door and Static Web App removed

Status: DECIDED (owner direction by voice, 2026-11-17); built.

## Context
The frontend was on an Azure Static Web App and the API on a Container App: two addresses, so every API call was
cross-origin and the backend had to list the frontend origin (`CEVOC_CORS_ALLOWED_ORIGINS`). A stale origin list broke
the site once already, and every new frontend address needed a backend change. The production answer, an edge in front
of both (Azure Front Door), is not available: the subscription is a Free Trial, and Front Door is reported refused on
those.

## Decision
- The app container serves both. The deploy workflows build the frontend with no API address (`VITE_API_BASE_URL` empty,
  so calls go to the same address) and copy `frontend/dist` into `backend/site`; the image copies it to `/app/site`, which
  Spring Boot serves (`spring.web.resources.static-locations`). `/` is the index page; the page paths the frontend reads
  from the address bar (`/demo-cases`, `/test-cases`, `/live-check`) are forwarded to it by `SiteController`.
- CORS is removed: `CorsConfig`, `cevoc.cors.allowed-origins`, `CEVOC_CORS_ALLOWED_ORIGINS` and their tests. Local
  development already used the Vite dev server's `/api` proxy, which is same-origin too.
- Front Door is removed from Bicep, Terraform, parameters and docs. When the app moves to a subscription that allows an
  edge (Front Door, or CloudFront on AWS), it goes in front of this one container with no app change.
- The three-container split (record 0027) is unchanged: the site joins the app container; the browser worker and the
  blur worker are untouched. The lean image copies the site too.
- Not over-engineered on purpose: no CDN, no caching rules, one address.

## Consequences
- The site's address is the app's address.
- The Static Web App is removed everywhere (owner, 2026-11-17: "remove and make it consistent"): Bicep and Terraform
  modules, outputs, the `Microsoft.Web` provider registration, `staticwebapp.config.json`, and the resource in
  `rg-cevoc-dev` (deleted once by `retire-static-web-app.yml`, which is then removed).
- AWS is made the same shape: the S3 frontend bucket is removed and CloudFront has one origin, the load balancer in
  front of the container, with caching off. CloudFront stays because on AWS an edge is available; it changes nothing in
  the app.
- A backend image deploy now also deploys the frontend.

## Ruled out
- Linking the Container App as the Static Web App's API backend: needs the Standard plan, and Microsoft documents the
  link as a portal step only.
- Keeping CORS with a computed origin list: works, but it is the moving part that already failed once.
