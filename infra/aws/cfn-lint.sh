#!/usr/bin/env bash
# Lint all CloudFormation templates with cfn-lint.
# Usage: ./cfn-lint.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Linting CloudFormation templates in ${DIR}"

TEMPLATES=()
for f in "$DIR"/*.yaml; do
  # Skip parameter files
  [[ "$(basename "$f")" == parameters* ]] && continue
  TEMPLATES+=("$f")
done

if [ ${#TEMPLATES[@]} -eq 0 ]; then
  echo "No templates found."
  exit 0
fi

echo "Templates: ${TEMPLATES[*]}"
cfn-lint "${TEMPLATES[@]}"
echo "==> All templates passed cfn-lint."
