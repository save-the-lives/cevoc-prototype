#!/usr/bin/env bash
# Bootstrap CEVOC Azure deployment identity + GitHub OIDC trust.
# Run ONCE from a developer's laptop with:
#   az login (as subscription Owner)
#   gh auth login (with repo admin)
#
# Usage: ./bootstrap.sh <environment> [resource-group]
#   environment: dev | staging | prod
#   resource-group: defaults to rg-cevoc-<environment>
#
# Creates:
#   1. Resource group (if missing)
#   2. Entra ID app registration: cevoc-<env>-deploy
#   3. Federated credential for GitHub Actions (main branch)
#   4. Contributor + RBAC Administrator roles on the resource group
#   5. GitHub repo secret: AZURE_<ENV>_CLIENT_ID
#   6. Registers required Azure resource providers
#
# Idempotent: safe to re-run.
set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|prod> [resource-group]}"
RG="${2:-rg-cevoc-${ENV}}"
REPO="save-the-lives/cevoc-prototype"
APP_NAME="cevoc-${ENV}-deploy"
CRED_NAME="cevoc-${ENV}-main"
SECRET_NAME="AZURE_$(echo "$ENV" | tr '[:lower:]' '[:upper:]')_CLIENT_ID"

echo "==> Bootstrapping CEVOC ${ENV} deploy identity"
echo "    Resource group: ${RG}"
echo "    App registration: ${APP_NAME}"
echo "    GitHub secret: ${SECRET_NAME}"
echo ""

# 1. Resource group
echo "--- Creating resource group (if missing)..."
az group create --name "$RG" --location australiaeast \
  --tags project=cevoc environment="$ENV" --output none 2>/dev/null || true

# 2. App registration
echo "--- Creating app registration..."
CLIENT_ID=$(az ad app list --display-name "$APP_NAME" --query '[0].appId' -o tsv 2>/dev/null || true)
if [[ -z "$CLIENT_ID" ]]; then
  CLIENT_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
  echo "    Created: ${CLIENT_ID}"
else
  echo "    Already exists: ${CLIENT_ID}"
fi

# Ensure service principal exists
SP_ID=$(az ad sp list --filter "appId eq '${CLIENT_ID}'" --query '[0].id' -o tsv 2>/dev/null || true)
if [[ -z "$SP_ID" ]]; then
  SP_ID=$(az ad sp create --id "$CLIENT_ID" --query id -o tsv)
  echo "    Service principal created"
fi

# 3. Federated credential
echo "--- Setting up GitHub OIDC federated credential..."
# Get GitHub org and repo IDs for the subject claim
GH_ORG_ID=$(gh api "orgs/save-the-lives" --jq '.id' 2>/dev/null || true)
GH_REPO_ID=$(gh api "repos/${REPO}" --jq '.id' 2>/dev/null || true)

if [[ -n "$GH_ORG_ID" && -n "$GH_REPO_ID" ]]; then
  SUBJECT="repo:save-the-lives@${GH_ORG_ID}/cevoc-prototype@${GH_REPO_ID}:ref:refs/heads/main"
else
  SUBJECT="repo:save-the-lives/cevoc-prototype:ref:refs/heads/main"
fi

# Check if credential already exists
EXISTING=$(az ad app federated-credential list --id "$CLIENT_ID" --query "[?name=='${CRED_NAME}'].name" -o tsv 2>/dev/null || true)
if [[ -z "$EXISTING" ]]; then
  az ad app federated-credential create --id "$CLIENT_ID" --parameters "{
    \"name\": \"${CRED_NAME}\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"${SUBJECT}\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" --output none
  echo "    Federated credential created (subject: ${SUBJECT})"
else
  echo "    Federated credential already exists"
fi

# 4. Role assignments
echo "--- Assigning roles on ${RG}..."
RG_ID=$(az group show --name "$RG" --query id -o tsv)

for ROLE in "Contributor" "Role Based Access Control Administrator"; do
  EXISTING_ROLE=$(az role assignment list --assignee "$CLIENT_ID" --role "$ROLE" --scope "$RG_ID" --query '[0].id' -o tsv 2>/dev/null || true)
  if [[ -z "$EXISTING_ROLE" ]]; then
    az role assignment create --assignee "$CLIENT_ID" --role "$ROLE" --scope "$RG_ID" --output none
    echo "    Assigned: ${ROLE}"
  else
    echo "    Already assigned: ${ROLE}"
  fi
done

# 5. GitHub secret
echo "--- Saving ${SECRET_NAME} to GitHub repo secrets..."
gh secret set "$SECRET_NAME" --repo "$REPO" --body "$CLIENT_ID"
echo "    Done"

# Also ensure tenant and subscription IDs are set
TENANT_ID=$(az account show --query tenantId -o tsv)
SUB_ID=$(az account show --query id -o tsv)
gh secret set "CEVOCBACKEND_AZURE_TENANT_ID" --repo "$REPO" --body "$TENANT_ID" 2>/dev/null || true
gh secret set "CEVOCBACKEND_AZURE_SUBSCRIPTION_ID" --repo "$REPO" --body "$SUB_ID" 2>/dev/null || true

# 6. Register resource providers
echo "--- Registering resource providers..."
for NS in Microsoft.App Microsoft.KeyVault Microsoft.OperationalInsights microsoft.insights Microsoft.ContainerRegistry; do
  STATE=$(az provider show --namespace "$NS" --query registrationState -o tsv 2>/dev/null || echo "NotRegistered")
  if [[ "$STATE" != "Registered" ]]; then
    az provider register --namespace "$NS" --wait || true
    echo "    Registered: ${NS}"
  else
    echo "    Already registered: ${NS}"
  fi
done

echo ""
echo "==> Bootstrap complete."
echo "    To deploy: push to main (validates automatically)"
echo "    To deploy now: gh workflow run iac-validate.yml -f deploy=true"
echo "    To tear down: az group delete --name ${RG} --yes"
