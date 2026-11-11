#!/usr/bin/env bash
# Deploy CEVOC infrastructure to Azure.
# Usage: ./deploy.sh <environment> [resource-group]
#   environment: dev | staging | prod
#   resource-group: defaults to cevoc-<environment>-rg
set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|prod> [resource-group]}"
RG="${2:-cevoc-${ENV}-rg}"
DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$ENV" != "dev" && "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "Error: environment must be dev, staging, or prod" >&2
  exit 1
fi

PARAM_FILE="${DIR}/parameters/${ENV}.bicepparam"
if [[ ! -f "$PARAM_FILE" ]]; then
  echo "Error: parameter file not found: ${PARAM_FILE}" >&2
  exit 1
fi

echo "==> Deploying CEVOC ${ENV} to resource group ${RG}"

# Create resource group if it doesn't exist
az group create --name "$RG" --location australiaeast --tags project=cevoc environment="$ENV" --output none 2>/dev/null || true

# Deploy
az deployment group create \
  --resource-group "$RG" \
  --template-file "${DIR}/main.bicep" \
  --parameters "${PARAM_FILE}" \
  --name "cevoc-${ENV}-$(date +%Y%m%d-%H%M%S)" \
  --output table

echo "==> Done. Check outputs above for URLs."
