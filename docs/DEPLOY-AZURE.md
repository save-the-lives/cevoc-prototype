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

## Backend auto-deploy (cevoc-backend, resource group `cevoc`)
`.github/workflows/cevoc-backend-AutoDeployTrigger-*.yml` deploys `backend/` on push to `main`.
`azure/container-apps-deploy-action` cannot build from source without a registry (it always pushes to `acrName`/`registryUrl`), so the workflow uses `az acr build` and `az containerapp update` instead.

One-time portal steps (about 3 minutes):
1. Azure portal > Create a resource > Container Registry. Resource group `cevoc`, Australia East, SKU Basic, any globally unique name (lowercase letters and digits, for example `cevocacr123`). Create.
2. Open the registry > Settings > Access keys > turn on "Admin user". (This lets the app pull without role assignments. The workflow reads the keys itself.)
3. GitHub repo > Settings > Secrets and variables > Actions > Variables > New repository variable: `ACR_NAME` = the registry name (no `.azurecr.io`).
4. Check the sign-in identity (the app registration behind `CEVOCBACKEND_AZURE_CLIENT_ID`) has Contributor on resource group `cevoc` (needed to build in ACR, set registry and update the app).
5. Re-run the workflow (Actions > Trigger auto deployment for cevoc-backend > Run workflow).

The workflow also sets ingress target port 8080 (matches `server.port=8080` and the Dockerfile).
Stronger alternative to admin keys: turn on the app's system-assigned identity, grant it AcrPull on the registry, and use `az containerapp registry set --identity system` in place of the username/password step.

## Backend image: GitHub Container Registry (current route)

Azure ACR Tasks is blocked on the trial subscription (`TasksOperationsNotAllowed`), so the backend workflow builds the image on the GitHub runner and pushes it to `ghcr.io/<owner>/cevoc-backend`. No Azure registry or `ACR_NAME` variable is needed any more.

One-time step after the first successful push: GitHub profile or org, Packages, `cevoc-backend`, Package settings, Change visibility to Public (the repo is public and the data is fictitious). Then re-run the workflow. If you prefer to keep it private, add a repo secret `GHCR_PULL_TOKEN` (classic token, `read:packages` only) and the workflow registers it with the Container App.
