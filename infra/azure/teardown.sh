#!/usr/bin/env bash
# Tear down a CEVOC environment. Deletes the RG and purges its Key Vault.
# The deploy identity stays — only retire.sh deletes it.
#
# Usage: ./teardown.sh <environment> [resource-group]
#   environment: dev | staging | prod
#   resource-group: defaults to rg-cevoc-<environment>
#
# Can run as:
#   - The subscription Owner (from Cloud Shell or laptop)
#   - The deploy identity (from GitHub Actions), if bootstrap gave it Key Vault Contributor
#
# Safe to re-run: skips steps that are already done.
set -euo pipefail

ENV="${1:?Usage: $0 <dev|staging|prod> [resource-group]}"
RG="${2:-rg-cevoc-${ENV}}"

if [[ "$ENV" != "dev" && "$ENV" != "staging" && "$ENV" != "prod" ]]; then
  echo "Error: environment must be dev, staging, or prod" >&2
  exit 1
fi

echo "==> Tearing down CEVOC ${ENV} (resource group: ${RG})"
echo ""

# --- Step 1: Compute the Key Vault name (same formula as main.bicep) ---
# uniqueString(resourceGroup().id) is an Azure ARM function; we replicate its
# output by querying the RG id before deletion. If the RG is already gone,
# we scan for soft-deleted vaults matching the pattern instead.
KV_NAME=""
RG_EXISTS=$(az group exists --name "$RG" 2>/dev/null || echo "false")
if [[ "$RG_EXISTS" == "true" ]]; then
  RG_ID=$(az group show --name "$RG" --query id -o tsv)
  # Azure's uniqueString is a deterministic 13-char base32 hash of the input.
  # We can't replicate it in bash, so list the actual Key Vaults in the RG.
  KV_NAME=$(az keyvault list --resource-group "$RG" --query "[?starts_with(name,'cevoc')].name" -o tsv 2>/dev/null | head -1 || true)
fi

# --- Step 2: Delete the resource group ---
if [[ "$RG_EXISTS" == "true" ]]; then
  echo "--- Deleting resource group ${RG}..."
  az group delete --name "$RG" --yes --output none
  echo "    Resource group deleted."
else
  echo "--- Resource group ${RG} does not exist (already deleted)."
fi

# --- Step 3: Purge the soft-deleted Key Vault ---
# After RG deletion, the vault enters soft-deleted state. Purge it by exact name.
if [[ -n "$KV_NAME" ]]; then
  echo "--- Purging soft-deleted Key Vault: ${KV_NAME}..."
  az keyvault purge --name "$KV_NAME" --output none 2>/dev/null || true
  echo "    Done."
else
  # Scan for any soft-deleted cevoc vaults (fallback if we couldn't get the name before deletion)
  echo "--- Scanning for soft-deleted Key Vaults..."
  DELETED=$(az keyvault list-deleted --query "[?starts_with(name,'cevoc${ENV}')].name" -o tsv 2>/dev/null || true)
  if [[ -n "$DELETED" ]]; then
    echo "$DELETED" | while read -r kv; do
      echo "    Purging: $kv"
      az keyvault purge --name "$kv" --output none 2>/dev/null || true
    done
  else
    echo "    No soft-deleted vaults found."
  fi
fi

echo ""
echo "==> Teardown complete."
echo "    The deploy identity (cevoc-${ENV}-deploy) is still in Entra ID."
echo "    To retire the environment permanently: ./retire.sh ${ENV}"
echo "    To rebuild: ./bootstrap.sh ${ENV} && deploy via GitHub Actions"
