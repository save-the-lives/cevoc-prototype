#!/usr/bin/env bash
# CEVOC — deploy AWS infrastructure via CloudFormation nested stacks.
#
# Prerequisites:
#   1. AWS CLI configured (aws configure)
#   2. An S3 bucket for nested templates (create one or use an existing one)
#   3. ACM certificates provisioned for the ALB domain (and us-east-1 for CloudFront)
#   4. Docker image pushed to ECR
#
# Usage:
#   ./deploy.sh <environment> <s3-bucket> [--image-uri <uri>]
#
# Example:
#   ./deploy.sh dev cevoc-cfn-templates --image-uri 123456789.dkr.ecr.ap-southeast-2.amazonaws.com/cevoc-dev:latest

set -euo pipefail

ENV="${1:?Usage: deploy.sh <dev|staging|prod> <s3-bucket> [--image-uri <uri>]}"
BUCKET="${2:?Usage: deploy.sh <env> <s3-bucket>}"
STACK_NAME="cevoc-${ENV}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARAM_FILE="${SCRIPT_DIR}/parameters/${ENV}.json"

if [[ ! -f "$PARAM_FILE" ]]; then
  echo "Error: parameter file not found: ${PARAM_FILE}" >&2
  exit 1
fi

# Optional --image-uri override
IMAGE_URI=""
shift 2
while [[ $# -gt 0 ]]; do
  case "$1" in
    --image-uri) IMAGE_URI="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# Upload nested templates to S3
TEMPLATE_PREFIX="cevoc/${ENV}"
echo "Uploading templates to s3://${BUCKET}/${TEMPLATE_PREFIX}/ ..."
for f in vpc.yaml ecr.yaml secrets.yaml alb.yaml ecs.yaml cloudfront.yaml monitoring.yaml; do
  aws s3 cp "${SCRIPT_DIR}/${f}" "s3://${BUCKET}/${TEMPLATE_PREFIX}/${f}" --quiet
done

TEMPLATE_BASE_URL="https://${BUCKET}.s3.amazonaws.com/${TEMPLATE_PREFIX}"

# Build parameter overrides
OVERRIDES="TemplateBaseUrl=${TEMPLATE_BASE_URL}"
if [[ -n "$IMAGE_URI" ]]; then
  OVERRIDES="${OVERRIDES} ImageUri=${IMAGE_URI}"
fi

echo "Deploying stack ${STACK_NAME} ..."
aws cloudformation deploy \
  --stack-name "$STACK_NAME" \
  --template-file "${SCRIPT_DIR}/main.yaml" \
  --parameter-overrides $OVERRIDES \
  --capabilities CAPABILITY_NAMED_IAM \
  --tags Project=cevoc Environment="${ENV}" \
  --no-fail-on-empty-changeset

echo ""
echo "Stack ${STACK_NAME} deployed."
aws cloudformation describe-stacks --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs' --output table 2>/dev/null || true
