#!/usr/bin/env bash
# Deploy CEVOC Azure infrastructure with Terraform/OpenTofu.
#
# Usage: ./deploy.sh <environment> [plan|apply|destroy]
#   environment: dev | staging | prod
#   action: plan (default) | apply | destroy
#
# Prerequisites:
#   - az login (or service principal env vars)
#   - terraform or tofu on PATH
#   - Resource group created by bootstrap.sh
#
# State is stored in Azure Blob Storage. Configure backend with:
#   export ARM_ACCESS_KEY=<storage-account-key>
#   or use -backend-config at init time.
set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|prod> [plan|apply|destroy]}"
ACTION="${2:-plan}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$ENV" != "dev" && "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "Error: environment must be dev, staging, or prod" >&2
  exit 1
fi

# Use tofu if available, otherwise terraform
TF=$(command -v tofu 2>/dev/null || command -v terraform 2>/dev/null || true)
if [[ -z "$TF" ]]; then
  echo "Error: neither tofu nor terraform found on PATH" >&2
  exit 1
fi
echo "Using: $TF"

cd "$SCRIPT_DIR"

# Initialize (idempotent)
$TF init -input=false \
  -backend-config="key=cevoc-${ENV}.tfstate"

case "$ACTION" in
  plan)
    $TF plan -var-file="environments/${ENV}.tfvars" -out="tfplan-${ENV}"
    echo ""
    echo "To apply: $0 ${ENV} apply"
    ;;
  apply)
    if [[ -f "tfplan-${ENV}" ]]; then
      $TF apply "tfplan-${ENV}"
    else
      $TF apply -var-file="environments/${ENV}.tfvars" -auto-approve
    fi
    ;;
  destroy)
    echo "WARNING: This will destroy all ${ENV} infrastructure."
    $TF destroy -var-file="environments/${ENV}.tfvars"
    ;;
  *)
    echo "Error: action must be plan, apply, or destroy" >&2
    exit 1
    ;;
esac
