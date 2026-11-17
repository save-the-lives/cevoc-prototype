# CEVOC: contract for anyone (person or agent) changing this repository

Read this before the first edit. It is short on purpose. The standing design is in `docs/ARCHITECTURE.md`,
decisions in `docs/decisions/`, current state in `docs/STATUS.md` and `docs/HANDOVER.md`.

## On arrival

1. Read this file, then `docs/STATUS.md`.
2. Read `.agents/lessons.yaml` (what went wrong before and where the fix lives) and `docs/exceptions.md`
   (rules that are knowingly not met right now, each with an expiry).
3. Look in the code, docs and decision records before asking the owner anything. Ask only when they do not
   answer it, and bring a recommendation.

## What "done" and "working" mean

- **A deploy is done only when the release gate is green** (`.github/workflows/release-gate.yml`): a real browser
  renders the deployed frontend and calls the API from it, and the live cases pass against the deployed backend.
  "The upload succeeded" and "the health endpoint answered" are not evidence that the app works.
- **Never say something works unless a check that ran says so.** If you could not check (for example the address is
  not reachable from where you run), say "could not verify" and name the check that will.
- **Diagnose through CI, not through the owner.** If you cannot reach a deployed address, run or write a workflow
  that can (browser check, logs, live cases). Do not ask the owner to open a page, read a log or paste an error.
- **Nothing fails silently.** No `|| true`, `2>/dev/null` or `| tail` on a command whose failure matters.

## Enforcement, strongest first

A rule that is only written down is the weakest kind. When something goes wrong, the fix is a check that fails,
not a sentence here. Each lesson in `.agents/lessons.yaml` names where its fix lives.

| Rule | Enforced by |
|---|---|
| The deployed site renders, scripts are served as JavaScript, and the page can call the API | `scripts/release-gate.mjs`, run by the release gate |
| Real lookups work on the deployed backend | `pdvt.yml`, run by the release gate |
| A demo case's video is served blurred (503 while blurring, then 200; 451 is a failure), never as a download | `scripts/diagnose-video.mjs`, run by the release gate |
| The running app has exactly the environment variables the workflow lists | "Verify env vars match this workflow" step in both deploy workflows |
| One deploy to an environment at a time | shared `concurrency` group in both deploy workflows |
| Backend tests and frontend build | `app-ci.yml` (see `docs/exceptions.md`: currently red, not yet a gate) |
| Everything below this table | instruction only |

## Deploying (Azure dev, `rg-cevoc-dev`)

- **A push only validates.** `iac-validate.yml` deploys only on a manual run with `deploy=true`.
  `deploy-image-only.yml` rebuilds and redeploys the app image (site and API) without touching infrastructure.
- **Environment variables are declared, not accumulated.** Deploys use `--replace-env-vars` with the full list.
  To add or remove a variable, change the list in **both** deploy workflows and the `EXPECTED` line of the check.
- **Real lookups need the full image** (`backend/Dockerfile`, with Chromium). `Dockerfile.lean` has no browser and
  can only serve demo data until the browser worker is wired in (record 0027).
- **The app's address is never typed into a workflow** (owner, 2026-11-17). `scripts/app-url.sh` decides: repo variable
  `CEVOC_APP_URL_FROM_AZURE=true` looks it up from Azure at run time; otherwise `CEVOC_APP_URL` must be set by a person.
  Both set, or neither, fails clearly. The address changes whenever the Container Apps environment is rebuilt.
- **One container, one address** (record 0031). The deploy workflows build the site with no API address and copy
  it into `backend/site`; the app serves it from `/app/site`. There is no CORS configuration and none is needed.
  Page paths the frontend reads from the address bar are listed in `SiteController`; add a new one there.
- **Lifecycle separation.** Deploy workflows never delete or purge. `teardown.sh` cleans up; `bootstrap.sh` does
  not work around teardown; nothing is reused across environments.

## Cloud and build facts checked the hard way

Do not guess a limit, a region or a flag. Check the provider's current documentation, or make CI prove it, before
pushing. These were each learned from a failed deploy:

- Static Web Apps (removed, record 0031) existed only in centralus, eastus2, westus2, westeurope and eastasia, and its
  GitHub Action served JavaScript as `application/octet-stream` (a blank page). Do not reintroduce a second host for
  the site: one container serves the site and the API.
- Azure Front Door is not available on this subscription (Free Trial); its module was removed (record 0031).
- A Basic-tier container registry has no ACR Tasks: use `docker build` and `docker push`, not `az acr build`.
- Container Apps probe limits: `initialDelaySeconds` 1 to 60, `periodSeconds` 1 to 240, `failureThreshold` 1 to 10,
  `timeoutSeconds` 1 to 240.
- `az containerapp update --set-env-vars` only adds; `--yaml` replaces the whole container spec.
- There is no Spring actuator: `/actuator/health` answers 404. Use `/api/demo/cases` (demo data on) or `/api/ping`.
- Maven `-DskipTests` still compiles tests; `-Dmaven.test.skip=true` skips compiling them too.
- A heredoc with unindented lines inside a workflow `run:` block breaks the workflow file.

## Standing rules (owner)

- The repository is public. No real notice numbers, plates, names or other personal data in files, commits or logs.
  Never store a vehicle registration number. No credentials anywhere; cloud credentials live only in GitHub secrets
  the owner sets.
- Demo is only an adapter on the live path: no demo-only routes, no fallback to raw video, no code that knows a
  particular demo case, plate or file name.
- Blur is always on and fails closed: if blurring fails, the media is not served.
- Video evidence is never downloadable, in any state, demo or live: `downloadHref` in `frontend/src/media.js` is the
  one rule every view uses, the server always sends video inline, and raw (unblurred) videos never sit in the public
  site (`backend/samples`, not `frontend/public`). Demo and live take the same path: link, media endpoint, blur.
- Every external address is one fully qualified URL setting; settings keep the `CEVOC_` prefix.
- Do not remove a workflow, script or setting until you have read what it does and searched the docs for its name.
  "Looks old" is not evidence. (`docs/decisions/0006`: published URLs must not change.)
- Keep comments and docs true: a change that makes a comment, a decision record or a config table wrong fixes it in
  the same change, or records the gap in `docs/exceptions.md`.
- A departure from a standing rule or a decision record is written in `docs/exceptions.md` with scope, reason and
  expiry. Do not depart silently and do not widen an existing line.
- Before every push: `cd frontend && npm run build`.

## Writing down a lesson

When the owner corrects something, a test or check breaks because of a change, or a change has to be undone, add an
entry to `.agents/lessons.yaml`: what happened, the right behaviour, and where the fix lives (a check, a rule in this
file, or a decision record). An entry is `open` until that fix exists, then `promoted`.
