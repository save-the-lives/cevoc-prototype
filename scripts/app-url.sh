#!/usr/bin/env bash
# The deployed app's address for a workflow, one way or the other, never both (owner, 2026-11-17):
#   repo variable CEVOC_APP_URL_FROM_AZURE=true  -> ask Azure now (needs azure/login first); CEVOC_APP_URL must be unset
#   otherwise                                    -> repo variable CEVOC_APP_URL, set by a person; missing = clear failure
# A one-off address given to a manual run (first argument) is used as is.
# Writes url=<address> to $GITHUB_OUTPUT. App and resource group: CEVOC_APP_NAME / CEVOC_RESOURCE_GROUP (the IaC's names).
set -euo pipefail
override=${1:-}
if [ -n "$override" ]; then url=$override
elif [ "${CEVOC_APP_URL_FROM_AZURE:-}" = true ]; then
  if [ -n "${CEVOC_APP_URL:-}" ]; then
    echo "::error::Both CEVOC_APP_URL_FROM_AZURE=true and CEVOC_APP_URL are set. Keep one: the flag (look up from Azure) or the address."
    exit 1
  fi
  fqdn=$(az containerapp show --name "${CEVOC_APP_NAME:?}" --resource-group "${CEVOC_RESOURCE_GROUP:?}" \
    --query properties.configuration.ingress.fqdn -o tsv)
  [ -n "$fqdn" ] || { echo "::error::Azure returned no address for $CEVOC_APP_NAME in $CEVOC_RESOURCE_GROUP"; exit 1; }
  url="https://$fqdn"
elif [ -n "${CEVOC_APP_URL:-}" ]; then url=$CEVOC_APP_URL
else
  echo "::error::No app address. Set the repo variable CEVOC_APP_URL_FROM_AZURE=true (look it up from Azure) or CEVOC_APP_URL (the address)."
  exit 1
fi
url=${url%/}
echo "App address: $url"
echo "url=$url" >> "$GITHUB_OUTPUT"
