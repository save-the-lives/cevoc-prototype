#!/usr/bin/env bash
# Deploy CEVOC AWS infrastructure against LocalStack.
# Same templates as the real deploy — only the endpoint differs.
#
# Usage: ./deploy-local.sh [--clean]
#   --clean: tear down LocalStack and volumes before starting
#
# Prerequisites: docker, aws CLI (or awslocal from pip install awscli-local)
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_ROOT="$(cd "$DIR/../.." && pwd)"
ENDPOINT="http://localhost:4566"
REGION="ap-southeast-2"
STACK_PREFIX="cevoc-local"

# AWS CLI wrapper — uses LocalStack endpoint
awsl() {
  aws --endpoint-url="$ENDPOINT" --region "$REGION" --no-cli-pager "$@"
}

# ── Handle --clean ──
if [[ "${1:-}" == "--clean" ]]; then
  echo "==> Cleaning up LocalStack..."
  (cd "$COMPOSE_ROOT" && docker compose --profile localstack down -v 2>/dev/null || true)
  echo "    Done."
  shift
fi

# ── Start LocalStack ──
echo "==> Starting LocalStack..."
(cd "$COMPOSE_ROOT" && docker compose --profile localstack up -d)

echo "Waiting for LocalStack to be ready..."
for i in $(seq 1 30); do
  if curl -sf "$ENDPOINT/_localstack/health" > /dev/null 2>&1; then
    echo "    LocalStack is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: LocalStack did not start within 5 minutes."
    exit 1
  fi
  sleep 10
done

# ── Lint first ──
echo ""
echo "==> Running cfn-lint..."
if command -v cfn-lint &>/dev/null; then
  bash "$DIR/cfn-lint.sh"
else
  echo "    cfn-lint not installed — skipping (pip install cfn-lint)"
fi

# ── Deploy stacks one by one (nested stacks aren't fully supported in LocalStack free) ──
echo ""
echo "==> Deploying individual stacks against LocalStack..."

STACKS_ORDER=(vpc ecr secrets alb ecs monitoring)
RESULTS=()

for stack_name in "${STACKS_ORDER[@]}"; do
  template="$DIR/${stack_name}.yaml"
  full_name="${STACK_PREFIX}-${stack_name}"

  if [ ! -f "$template" ]; then
    echo "  SKIP: ${stack_name}.yaml not found"
    RESULTS+=("$stack_name: SKIPPED")
    continue
  fi

  echo "  Deploying: $full_name"

  # Build parameter overrides for required params with dummy values
  PARAMS=""
  case "$stack_name" in
    vpc)
      PARAMS="ParameterKey=Environment,ParameterValue=dev"
      ;;
    ecr)
      PARAMS="ParameterKey=Environment,ParameterValue=dev"
      ;;
    secrets)
      PARAMS="ParameterKey=Environment,ParameterValue=dev"
      ;;
    alb)
      PARAMS="ParameterKey=Environment,ParameterValue=dev ParameterKey=VpcId,ParameterValue=vpc-12345 ParameterKey=PublicSubnets,ParameterValue=subnet-1\\,subnet-2 ParameterKey=CertificateArn,ParameterValue=arn:aws:acm:${REGION}:000000000000:certificate/dummy"
      ;;
    ecs)
      PARAMS="ParameterKey=Environment,ParameterValue=dev ParameterKey=VpcId,ParameterValue=vpc-12345 ParameterKey=PrivateSubnets,ParameterValue=subnet-1\\,subnet-2 ParameterKey=AlbTargetGroupArn,ParameterValue=arn:aws:elasticloadbalancing:${REGION}:000000000000:targetgroup/dummy/1234 ParameterKey=AlbSecurityGroupId,ParameterValue=sg-12345 ParameterKey=ImageUri,ParameterValue=000000000000.dkr.ecr.${REGION}.amazonaws.com/cevoc:latest ParameterKey=TaskRoleArn,ParameterValue=arn:aws:iam::000000000000:role/dummy ParameterKey=ExecutionRoleArn,ParameterValue=arn:aws:iam::000000000000:role/dummy"
      ;;
    monitoring)
      PARAMS="ParameterKey=Environment,ParameterValue=dev"
      ;;
  esac

  if awsl cloudformation deploy \
    --stack-name "$full_name" \
    --template-file "$template" \
    --parameter-overrides $PARAMS \
    --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
    --no-fail-on-empty-changeset \
    2>&1 | tail -5; then
    RESULTS+=("$stack_name: ✅ SUCCESS")
  else
    RESULTS+=("$stack_name: ❌ FAILED")
  fi
done

# ── Report ──
echo ""
echo "=== LocalStack Deploy Report ==="
for r in "${RESULTS[@]}"; do
  echo "  $r"
done
echo ""
echo "LocalStack endpoint: $ENDPOINT"
echo "To tear down: docker compose --profile localstack down -v"
echo "To tear down and redeploy: $0 --clean"
