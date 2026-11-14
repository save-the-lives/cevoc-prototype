#!/usr/bin/env bash
# Deploy CEVOC AWS infrastructure with Terraform or OpenTofu.
# Usage: ./deploy.sh <environment> [plan|apply|destroy]
set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|prod> [plan|apply|destroy]}"
ACTION="${2:-plan}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TFVARS="${SCRIPT_DIR}/environments/${ENV}.tfvars"

if [ ! -f "$TFVARS" ]; then
  echo "ERROR: No tfvars file at ${TFVARS}" >&2
  exit 1
fi

# Prefer OpenTofu, fall back to Terraform
if command -v tofu &>/dev/null; then
  TF=tofu
elif command -v terraform &>/dev/null; then
  TF=terraform
else
  echo "ERROR: Neither tofu nor terraform found in PATH" >&2
  exit 1
fi

echo "==> Using ${TF} for CEVOC ${ENV} (${ACTION})"

cd "$SCRIPT_DIR"
$TF init -upgrade

case "$ACTION" in
  plan)
    $TF plan -var-file="$TFVARS" -out=tfplan
    echo "==> To apply: ./deploy.sh ${ENV} apply"
    ;;
  apply)
    if [ -f tfplan ]; then
      $TF apply tfplan
    else
      $TF apply -var-file="$TFVARS" -auto-approve
    fi
    ;;
  destroy)
    $TF destroy -var-file="$TFVARS" -auto-approve
    ;;
  *)
    echo "ERROR: Unknown action: ${ACTION} (use plan, apply, or destroy)" >&2
    exit 1
    ;;
esac
