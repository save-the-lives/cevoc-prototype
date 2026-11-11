# CEVOC Azure Infrastructure

Infrastructure as Code for the CEVOC prototype, using Azure Bicep with Container Apps.

## Prerequisites

- Azure CLI (`az`) installed and logged in as subscription Owner
- GitHub CLI (`gh`) authenticated with repo admin access
- Bicep CLI (bundled with Azure CLI 2.20+)

## Lifecycle: bootstrap → deploy → teardown → redeploy

The full hands-off path:

```bash
# 1. Bootstrap (once per environment, as subscription Owner)
./bootstrap.sh dev

# 2. Deploy (from GitHub Actions — no manual steps)
gh workflow run iac-validate.yml --repo save-the-lives/cevoc-prototype -f deploy=true

# 3. Tear down (keeps the deploy identity for next cycle)
./teardown.sh dev

# 4. Redeploy (no bootstrap needed — identity persists)
gh workflow run iac-validate.yml --repo save-the-lives/cevoc-prototype -f deploy=true

# 5. Retire permanently (only when the environment is gone for good)
./retire.sh dev
```

### What each script does

| Script | Runs as | What it does | What it leaves |
|--------|---------|--------------|----------------|
| `bootstrap.sh` | Owner (Cloud Shell) | Creates RG, app registration, federated credential, roles, GitHub secrets, registers providers | Everything needed for hands-off deploys |
| `deploy.sh` | Owner (laptop) | Deploys Bicep templates to a resource group | Running infrastructure |
| `teardown.sh` | Owner or deploy identity | Deletes the RG, purges the soft-deleted Key Vault | Deploy identity stays |
| `retire.sh` | Owner | Runs teardown + deletes the app registration + removes GitHub secret | Nothing |

### Key rules

- **Deploy never cleans up.** It only creates or updates resources. Cleanup is teardown's job.
- **Teardown purges by exact name.** It knows the Key Vault name from the RG before deleting it.
- **Bootstrap never works around teardown failures.** If teardown left a mess, fix teardown.
- **No resource reuse across environments.** Each environment gets its own resources.

## Modules

| Module | Resources | Notes |
|--------|-----------|-------|
| `container-app` | Container Apps managed environment + container app | Scale 0-1 (dev) / 1-3 (prod). System-assigned managed identity. Health check on `/actuator/health`. Optional blur worker. |
| `container-registry` | Azure Container Registry | Basic (dev) / Standard (prod). AcrPull role granted to container app identity. |
| `key-vault` | Key Vault | Stores API keys and connection strings. Container app identity gets `get`+`list` on secrets. Name includes environment to avoid soft-delete collisions. |
| `monitoring` | Log Analytics + Application Insights | 30-day retention. Connection string injected into container app. |
| `front-door` | Front Door Standard + WAF | Prod only. HTTPS redirect, compression, health probes. WAF in Detection mode initially. |

## Environment variables set on Container App

| Variable | Source |
|----------|--------|
| `SERVER_PORT` | `8080` |
| `SPRING_PROFILES_ACTIVE` | Parameter (matches environment) |
| `AZURE_KEY_VAULT_URI` | Key Vault module output |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Monitoring module output |
| `CEVOC_DEMO_DATA_ENABLED` | `true` |

## Secrets

All secrets live in Key Vault. The app reads them at startup via Spring Cloud Azure Key Vault integration. To add a secret:

```bash
az keyvault secret set --vault-name <vault-name> --name MY-SECRET --value "..."
```

Reference it in Spring Boot as `${MY_SECRET}` (Key Vault names with hyphens become underscored env vars).

## Trial subscription limitation

Azure trial subscriptions allow only **1 Container App Environment globally** (not per region). If the live app already has one in AU East, a dev deploy to any region will fail with `MaxNumberOfGlobalEnvironmentsInSubExceeded`. This is expected — the templates are correct for production subscriptions. On a trial, either upgrade the subscription or use the live environment's region for dev (but this couples dev and live, which is not recommended).

## Architecture

```
Internet → Front Door (prod) → Container App (from ACR)
                                    ↓
                              Key Vault (secrets)
                              App Insights (telemetry)
                              
                            Blur Worker (optional, from ACR)
                              ↓
                            Queue (Redis/SQS/Azure Queue)
```

## CI/CD workflow

The `iac-validate.yml` workflow:
- **On push to `infra/azure/`**: lint → validate → what-if (dry run)
- **On manual trigger with `deploy=true`**: lint → pre-flight checks → deploy

Pre-flight checks verify: resource providers registered, no soft-deleted vault collisions, resource group exists. If any check fails, the workflow stops with a clear message pointing to the fix (run bootstrap or teardown).
