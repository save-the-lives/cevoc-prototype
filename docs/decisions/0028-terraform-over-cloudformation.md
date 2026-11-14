# ADR-0028: Terraform/OpenTofu over CloudFormation

## Status
Accepted

## Context
Transport for NSW (TfNSW) standardises on Terraform/OpenTofu for infrastructure-as-code.
The CEVOC prototype was initially built with Azure Bicep and AWS CloudFormation, both
vendor-native IaC tools. For a smooth handover to the development team, the IaC should
use the same tooling the team already knows and has pipelines for.

## Decision
Port all infrastructure definitions to standard Terraform HCL, compatible with both
HashiCorp Terraform (>= 1.5) and OpenTofu (>= 1.6). CI uses OpenTofu for licence
compatibility. The original Bicep and CloudFormation templates are retained as reference
implementations under `infra/azure/` and `infra/aws/`.

### New layout
```
infra/terraform/
  azure/          # Port of infra/azure/ (Bicep → Terraform)
    modules/      # container-registry, container-app, key-vault, monitoring, front-door
    environments/ # dev.tfvars, prod.tfvars
    deploy.sh     # Wrapper: init + plan/apply/destroy
  aws/            # Port of infra/aws/ (CloudFormation → Terraform)
    modules/      # vpc, ecr, ecs, alb, secrets, monitoring, cloudfront
    environments/ # dev.tfvars, prod.tfvars
```

## Consequences
- Development team can use their existing Terraform workflows and modules
- State management via standard Terraform backends (Azure Blob, S3)
- OpenTofu in CI avoids BSL licence concerns
- Original Bicep/CFN kept for reference — no information lost
- One tool per state file per environment (standing rule)
