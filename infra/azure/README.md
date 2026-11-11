# CEVOC Azure Infrastructure

Infrastructure as Code for the CEVOC prototype, using Azure Bicep.

## Prerequisites

- Azure CLI (`az`) installed and logged in
- Contributor role on the target subscription
- Bicep CLI (bundled with Azure CLI 2.20+)

## Quick start

```bash
# Dev environment
./deploy.sh dev

# Production (includes Front Door + WAF)
./deploy.sh prod

# Custom resource group
./deploy.sh dev my-custom-rg
```

## Modules

| Module | Resources | Notes |
|--------|-----------|-------|
| `container-registry` | Azure Container Registry | Basic (dev) / Standard (prod). AcrPull role granted to App Service identity. |
| `app-service` | App Service Plan + Web App | Linux container from ACR. B1 (dev) / P1v3 (prod). System-assigned managed identity. Health check on `/actuator/health`. |
| `key-vault` | Key Vault | Stores API keys and connection strings. App Service identity gets `get`+`list` on secrets. |
| `monitoring` | Log Analytics + Application Insights | 30-day retention. Connection string injected into App Service. |
| `front-door` | Front Door Standard + WAF | Prod only. HTTPS redirect, compression, health probes. WAF in Detection mode initially. |

## Environment variables set on App Service

| Variable | Source |
|----------|--------|
| `WEBSITES_PORT` | `8080` |
| `SPRING_PROFILES_ACTIVE` | Parameter (matches environment) |
| `AZURE_KEY_VAULT_URI` | Key Vault module output |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Monitoring module output |
| `DOCKER_ENABLE_CI` | `true` (ACR webhook for continuous deployment) |

## Secrets

All secrets live in Key Vault. The app reads them at startup via Spring Cloud Azure Key Vault integration. To add a secret:

```bash
az keyvault secret set --vault-name cevoc-dev-kv --name MY-SECRET --value "..."
```

Reference it in Spring Boot as `${MY_SECRET}` (Key Vault names with hyphens become underscored env vars).

## Customising

- **Scaling:** Change `capacity` in `app-service.bicep` or add autoscale rules.
- **Custom domain:** Add a `customHostNames` property to the Web App and a CNAME to Front Door.
- **WAF to Prevention:** Change `mode` in `front-door.bicep` from `Detection` to `Prevention` after testing.
- **Network lockdown:** Set Key Vault `defaultAction` to `Deny` and add App Service subnet to `virtualNetworkRules`.

## Architecture

```
Internet → Front Door (prod) → App Service (container from ACR)
                                    ↓
                              Key Vault (secrets)
                              App Insights (telemetry)
```
