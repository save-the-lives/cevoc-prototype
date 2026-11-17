#!/usr/bin/env bash
# Blur worker (record 0036), shared by both deploy workflows so they cannot drift.
#   scripts/blur-worker.sh build  <login-server> <tag>            build and push cevoc-blur-worker:<tag>
#   scripts/blur-worker.sh deploy <login-server> <tag> <rg> <mode> point the worker app at the image
# mode is the app's CEVOC_BLUR_MODE: "http" needs the worker; "process" (roll back) leaves it as it is.
set -euo pipefail
cmd=$1 server=$2 tag=$3
case "$cmd" in
  build)
    docker build -t "$server/cevoc-blur-worker:$tag" -f backend/blur-worker/Dockerfile.http backend/
    docker push "$server/cevoc-blur-worker:$tag"
    ;;
  deploy)
    rg=$4 mode=$5 name=cevoc-dev-blur-worker
    if ! az containerapp show --name "$name" --resource-group "$rg" -o none 2>/dev/null; then
      if [ "$mode" = http ]; then
        echo "::error::$name does not exist; run the full deploy (iac-validate.yml, deploy=true) to create it, or deploy with blur_mode=process"
        exit 1
      fi
      echo "::notice::No blur worker; blur runs inside the app (mode $mode)"; exit 0
    fi
    az containerapp registry set --name "$name" --resource-group "$rg" --server "$server" --identity system --output none
    az containerapp update --name "$name" --resource-group "$rg" --image "$server/cevoc-blur-worker:$tag" --output none
    # The worker must answer before the app is pointed at it: one request through the app's environment is not possible
    # from here, so check the revision is healthy.
    for i in $(seq 1 30); do
      STATE=$(az containerapp show --name "$name" --resource-group "$rg" --query 'properties.latestRevisionName' -o tsv \
        | xargs -I{} az containerapp revision show --name "$name" --resource-group "$rg" --revision {} --query 'properties.healthState' -o tsv)
      echo "Blur worker revision health: $STATE"
      [ "$STATE" = Healthy ] && exit 0
      # Scaled to zero is not a failure: it starts on the first request.
      [ "$STATE" = None ] && exit 0
      sleep 10
    done
    echo "::error::Blur worker revision not healthy"; exit 1
    ;;
  *) echo "usage: $0 build|deploy ..."; exit 2 ;;
esac
