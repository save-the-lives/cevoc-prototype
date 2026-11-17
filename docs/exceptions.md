# Exceptions in force

Rules and decisions that are knowingly not met right now. One line each: what it departs from, why, who granted it,
and the last day it applies. An expired line is no line: the rule applies again. Only the owner adds or extends a
line marked "owner"; a line marked "needs owner" is a gap an agent found and is waiting for a decision.

| id | Departs from | What is true instead | Reason | Granted by | Expires |
|---|---|---|---|---|---|
| tests-red | Tests pass before a deploy (`app-ci.yml`) | Backend, browser-profile and blur jobs are green (2026-11-17, run 43960792280). 17 frontend demo-hub tests fail: the default-block demo cases (000000) now carry speeding text, so the page treats them as speed camera notices; waiting on the owner's choice. The Docker build still skips tests (`-Dmaven.test.skip=true`) | Tests had drifted unnoticed; most failures were tests left behind by deliberate changes, five were real bugs (fixed) | owner (2026-11-17, by voice); fixing is still the next job | 2027-12-31 |
| scrapers-on-by-default | Standing rule "scrapers stay off by default"; record 0022 point 4 | With no settings at all the browser route runs wherever Chromium is installed. `stub` is still the explicit off switch | Owner removed the contact requirement on 2026-11-17 (record 0029). The contact used to be what kept the route off | owner (2026-11-17); confirm the side effect | 2026-11-30 |
| lean-image-unused | Record 0027 (three-container split) | Both deploy workflows build the full image; `Dockerfile.lean` and the browser worker image are built but not serving | Real lookups need Chromium and the worker is not wired in yet | needs owner | 2026-12-31 |
| probe-paths | Bicep probes should point at a real endpoint | `infra/azure/modules/container-app.bicep` probes name `/actuator/health`, which does not exist; the running app uses Azure's default probes | Not yet fixed; harmless while the placeholder deploy sets no probes | needs owner | 2026-11-30 |
| http-route-not-equivalent | Owner direction 2026-11-17: cheapest route first (record 0030) | Default is the browser route; the cheaper HTTP route is opt-in | Live cases showed the HTTP route returning wrong final answers for identity-required notices and missing photos for a mobile phone case | needs owner | 2026-12-15 |
