# Exceptions in force

Rules and decisions that are knowingly not met right now. One line each: what it departs from, why, who granted it,
and the last day it applies. An expired line is no line: the rule applies again. Only the owner adds or extends a
line marked "owner"; a line marked "needs owner" is a gap an agent found and is waiting for a decision.

| id | Departs from | What is true instead | Reason | Granted by | Expires |
|---|---|---|---|---|---|
| tests-red | Tests pass before a deploy (`app-ci.yml`) | 29 of 455 backend tests and several frontend tests fail; deploys do not wait for them. The Docker build skips tests (`-Dmaven.test.skip=true`) | Tests had drifted unnoticed; found 2026-11-17 when the workflow was restored. About ten failures come from record 0029, the rest are older | needs owner | 2026-11-30 |
| scrapers-on-by-default | Standing rule "scrapers stay off by default"; record 0022 point 4 | With no settings at all the browser route runs wherever Chromium is installed. `stub` is still the explicit off switch | Owner removed the contact requirement on 2026-11-17 (record 0029). The contact used to be what kept the route off | owner (2026-11-17); confirm the side effect | 2026-11-30 |
| lean-image-unused | Record 0027 (three-container split) | Both deploy workflows build the full image; `Dockerfile.lean` and the browser worker image are built but not serving | Real lookups need Chromium and the worker is not wired in yet | needs owner | 2026-12-31 |
| probe-paths | Bicep probes should point at a real endpoint | `infra/azure/modules/container-app.bicep` probes name `/actuator/health`, which does not exist; the running app uses Azure's default probes | Not yet fixed; harmless while the placeholder deploy sets no probes | needs owner | 2026-11-30 |
| first-environment-deploys | The first environment (`cevoc` resource group, `calm-water` site) can be deployed | Its two deploy workflows were removed on 2026-11-17; `demo-probe.yml`, `live-check-run.yml` and the default of `pdvt.yml` still point at it | The owner deleted that resource group on 2026-11-11 to free the trial's one environment slot; confirm these can be retired or repointed at dev | needs owner | 2026-11-30 |
