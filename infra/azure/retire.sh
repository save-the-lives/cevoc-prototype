#!/usr/bin/env bash
# Permanently retire a CEVOC environment: tear down + delete the deploy identity.
# Run this only when the environment is gone for good.
#
# Usage: ./retire.sh <environment>
#   environment: dev | staging | prod
#
# Must run as subscription Owner (not the deploy identity — it can't delete itself).
# Requires gh CLI authenticated with repo admin access.
set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|prod>}"
RG="rg-cevoc-${ENV}"
APP_NAME="cevoc-${ENV}-deploy"
REPO="save-the-lives/cevoc-prototype"
SECRET_NAME="AZURE_$(echo "$ENV" | tr '[:lower:]' '[:upper:]')_CLIENT_ID"

if [[ "$ENV" != "dev" && "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "Error: environment must be dev, staging, or prod" >&2
  exit 1
fi

echo "==> Retiring CEVOC ${ENV} permanently"
echo "    This deletes the deploy identity. Use teardown.sh if you plan to rebuild."
echo ""
read -rp "Are you sure? This cannot be undone. [y/N] " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted." >&2
  exit 1
fi

# --- Step 1: Tear down (if not already done) ---
DIR="$(cd "$(dirname "$0")" && pwd)"
if az group exists --name "$RG" 2>/dev/null | grep -q true; then
  echo "--- Resource group ${RG} still exists. Running teardown first..."
  bash "${DIR}/teardown.sh" "$ENV" "$RG"
fi

# --- Step 2: Delete the app registration ---
echo "--- Deleting app registration: ${APP_NAME}..."
APP_ID=$(az ad app list --display-name "$APP_NAME" --query '[0].id' -o tsv 2>/dev/null || true)
if [[ -n "$APP_ID" ]]; then
  az ad app delete --id "$APP_ID" --output none
  echo "    Deleted."
else
  echo "    Not found (already deleted)."
fi

# --- Step 3: Remove the GitHub secret ---
echo "--- Removing GitHub secret: ${SECRET_NAME}..."
gh secret remove "$SECRET_NAME" --repo "$REPO" 2>/dev/null || true
echo "    Done."

echo ""
echo "==> Environment ${ENV} retired."
echo "    To set up again from scratch: ./bootstrap.sh ${ENV}"
