# Deploying the app to Azure (Australia East)

Untested: written before any Azure account was connected. Treat as a checklist.
Only `backend/` and `frontend/` deploy. The prototype stays on GitHub Pages.

Shape: Static Web Apps serves the React site and proxies `/api` to a Container Apps backend (linked backend), so the front end needs no API URL and no CORS setup.

## One-time setup (Azure CLI, in your subscription)
    az group create -n cevoc-rg -l australiaeast
    az acr create -g cevoc-rg -n <uniqueacrname> --sku Basic
    az containerapp env create -g cevoc-rg -n cevoc-env -l australiaeast
    az containerapp create -g cevoc-rg -n cevoc-backend --environment cevoc-env \
      --image mcr.microsoft.com/azuredocs/containerapps-helloworld:latest \
      --target-port 8080 --ingress external --min-replicas 0 --max-replicas 2
    az staticwebapp create -g cevoc-rg -n cevoc-web -l eastasia --sku Standard
    # Static Web Apps linked backends need the Standard plan; check current pricing and trial terms.
    az staticwebapp backends link -g cevoc-rg -n cevoc-web \
      --backend-resource-id $(az containerapp show -g cevoc-rg -n cevoc-backend --query id -o tsv) \
      --backend-region australiaeast
Also let the pipeline pull images: give the Container App access to the registry (managed identity with AcrPull), per Azure docs.

## GitHub setup
Repo variables: `ACR_NAME`, `CONTAINER_APP_NAME` (cevoc-backend), `AZURE_RESOURCE_GROUP` (cevoc-rg).
Repo secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` (an Entra app registration with a federated credential for this repo and Contributor on the resource group), and `AZURE_STATIC_WEB_APPS_API_TOKEN` (from the Static Web App).
Never commit credentials.

## Run
Actions > "App deploy to Azure" > Run workflow. CI (`app-ci.yml`) runs the backend tests and frontend build on every change under `backend/` or `frontend/`.

## Open decisions
- Automatic deploy on every merge to `main`, or manual only (manual for now).
- Static Web Apps region: the service resolves to a nearby region; confirm data residency needs. The Container Apps backend is in Australia East.
- Keep data fictitious and the "prototype only" banner on until real sources are connected.
