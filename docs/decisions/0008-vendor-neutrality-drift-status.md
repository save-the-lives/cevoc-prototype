# 0008. Vendor-neutrality: drift status

Status: Accepted (audit result, report only; nothing was changed by the audit)
Date recorded: 2026-11-04
Owner approval: the audit was requested by the owner on 2026-11-04. Which findings to fix is pending the owner.

## Chosen
Keep checking the code against record 0002. This record holds the current drift status and is updated when findings are fixed.

## Result in one paragraph
No Azure, AWS, GitHub or ghcr.io specifics were found in `domain` or `application` (PROVEN by search and by `ArchitectureTest` rules). The main drift is: `BeanConfig` and `pom.xml` carry the Azure SDK, the CORS default is an Azure host name, the UI has Revenue NSW wording and phone number hard coded, the domain `StepCause` matches Playwright message text, and doc comments in the domain name Revenue NSW. The deploy side is Azure specific by design and needs a new AWS workflow, an S3/CloudFront adapter and an image registry change to move.

## Findings
See the table in the hand-off log entry of 2026-11-04 and the summary below. Severity: core leak / adapter-level acceptable / deploy-level acceptable. PROVEN means checked in the files; INFERRED means reasoned.

| # | Where | Vendor specific | Severity | Suggested fix | Proof |
|---|---|---|---|---|---|
| 1 | `domain/StepCause.java` `of()` | Matches Playwright and Chromium message strings (`playwright was just installed`, `browsertype.launch`, `net::err_`) | core leak | Map failures to causes inside the browser adapter; keep only the cause tokens in the domain | PROVEN |
| 2 | `domain/NoticeDetails.java`, `PenaltyLookupResult.java`, `CertificateQuery.java`, `RegistrationScope.java` (comments) | Names Revenue NSW, `searchCertificates.jsf`, the evidence scraper | core leak (comments only, no code dependency) | Reword to provider-neutral language | PROVEN |
| 3 | `domain/CertificateQuery.java`, `domain/PenaltyLookupResult.java` `cameraCode` | Shape follows the certificates page (location code, dd/MM/yyyy HH:mm) and the image banner | core leak, mild (the canonical model is shaped by one provider) | Keep `locationCode` as a neutral key; confirm it matches the TfNSW API when known | INFERRED |
| 4 | `frontend/src/journey.js`, `Notice.jsx`, `LookupForm.jsx` | Revenue NSW name and phone number in user-facing text, and a status default that names Revenue NSW | core leak (UI) | Move agency name and phone to configuration or the lookup response | PROVEN |
| 5 | `config/BeanConfig.java` | Imports Azure SDK types, builds the Azure client | adapter-level acceptable (composition root) | Optionally move the Azure bean into the Azure adapter package | PROVEN |
| 6 | `backend/pom.xml` | Azure SDK dependency always on the classpath | adapter-level acceptable | Put the Azure SDK under a Maven profile, add an AWS profile later | PROVEN |
| 7 | `application.properties` | CORS default is an `azurestaticapps.net` host; `cevoc.media.azure.*` keys | adapter-level acceptable, the CORS default is a leak into config shape | Make the CORS default empty and set it per deployment | PROVEN |
| 8 | `scraper/ScraperSettings.java` (User-Agent text), `CertificateScraperProperties.java` | Names the agency and the GitHub repository in the User-Agent | adapter-level acceptable | Keep; it is the honest identification of the caller | PROVEN |
| 9 | `adapter/out/scraper/*`, `src/live/*`, `LiveCheckController` | Revenue NSW, TfNSW hosts, Chromium, Playwright | adapter-level acceptable (temporary) | Delete at cutover as listed in record 0004 | PROVEN |
| 10 | `.github/workflows/cevoc-backend-AutoDeployTrigger-*.yml` | `az containerapp`, Azure OIDC login, `ghcr.io`, GitHub cache | deploy-level acceptable | Add `app-deploy-aws.yml`; replace the registry and rollout steps | PROVEN |
| 11 | `app-deploy-azure.yml`, `azure-static-web-apps-*.yml`, `live-check-run.yml` | Azure login, Static Web Apps, ACR | deploy-level acceptable | Replace with S3/CloudFront deploy for the front end | PROVEN |
| 12 | `frontend/public/staticwebapp.config.json` | Azure Static Web Apps routing file | deploy-level acceptable | Replace with a CloudFront function or error-page rule | PROVEN |
| 13 | `backend/Dockerfile` | Plain Docker, but includes Chromium | deploy-level acceptable; portable | Drop Chromium layers at cutover | PROVEN |
| 14 | No S3 adapter exists | `adapter/out/s3` is a `package-info` placeholder only | adapter-level gap | Build `S3MediaStorageAdapter` and signed-link adapter before cutover | PROVEN |

## What would need rework to move to AWS
New: S3/CloudFront media and signed-link adapters, `app-deploy-aws.yml`, ECR and ECS (or App Runner) setup, CloudFront routing for `/api/*`, IAM OIDC role. Changed: image registry steps (ghcr.io to ECR), the CORS default, the front-end routing file. Unchanged: domain, application, the web adapter, the React app, the Dockerfile (minus Chromium). Runbook: `docs/RUNBOOK-AWS.md` (draft, untested).

## Ruled out
Fixing findings in the audit itself (report only).
