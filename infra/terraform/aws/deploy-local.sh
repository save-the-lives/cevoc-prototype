#!/usr/bin/env bash
# Validate CEVOC AWS Terraform against LocalStack.
# Requires: docker, docker-compose, tofu or terraform
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "==> Starting LocalStack..."
cd "$REPO_ROOT"
docker compose --profile localstack up -d localstack
sleep 5  # Wait for LocalStack to be ready

# Prefer OpenTofu
if command -v tofu &>/dev/null; then TF=tofu; else TF=terraform; fi

echo "==> Running ${TF} init + plan against LocalStack..."
cd "$SCRIPT_DIR"

# Override provider to point at LocalStack
cat > _localstack_override.tf << 'EOF'
provider "aws" {
  region                      = "ap-southeast-2"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    ec2            = "http://localhost:4566"
    ecr            = "http://localhost:4566"
    ecs            = "http://localhost:4566"
    elasticloadbalancingv2 = "http://localhost:4566"
    cloudwatch     = "http://localhost:4566"
    cloudfront     = "http://localhost:4566"
    iam            = "http://localhost:4566"
    secretsmanager = "http://localhost:4566"
    sns            = "http://localhost:4566"
    sts            = "http://localhost:4566"
    logs           = "http://localhost:4566"
  }

  default_tags {
    tags = {
      Project     = "cevoc"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}
EOF

$TF init -upgrade
$TF plan -var-file=environments/dev.tfvars -out=tfplan-local
$TF apply tfplan-local

echo "==> LocalStack validation passed"

# Cleanup
rm -f _localstack_override.tf tfplan-local
$TF init -upgrade  # Re-init without override
