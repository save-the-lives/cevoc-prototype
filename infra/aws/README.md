# CEVOC — AWS Infrastructure (CloudFormation)

Infrastructure as Code for deploying the CEVOC prototype on AWS using CloudFormation nested stacks.

## Architecture

```
Internet → CloudFront (prod only) → ALB (HTTPS) → ECS Fargate → Spring Boot + Python container
                                                       ↓
                                              Secrets Manager (API keys)
```

| Stack | What it creates |
|-------|----------------|
| `vpc.yaml` | VPC, 2 public + 2 private subnets, Internet Gateway, NAT Gateway (single dev, HA prod) |
| `ecr.yaml` | ECR repository with image lifecycle policy |
| `secrets.yaml` | Secrets Manager secret, ECS task role (reads secrets), execution role (pulls from ECR) |
| `alb.yaml` | Application Load Balancer, HTTPS listener (ACM cert), HTTP→HTTPS redirect, target group |
| `ecs.yaml` | ECS Fargate cluster, service (1 task dev, 2 prod), task definition (1 vCPU/2 GB dev, 2/4 prod) |
| `cloudfront.yaml` | CloudFront distribution in front of ALB (prod only, optional custom domain) |
| `monitoring.yaml` | CloudWatch log group (14 days dev, 90 prod), CPU/memory alarms, SNS topic (prod) |
| `main.yaml` | Root stack that wires the above together |

## Prerequisites

1. **AWS CLI** configured with credentials (`aws configure`)
2. **S3 bucket** for nested CloudFormation templates
3. **ACM certificate** for the ALB domain (in the deployment region)
4. **ACM certificate in us-east-1** for CloudFront (prod only)
5. **Docker image** pushed to ECR

## Deploy

```bash
# First time: create the ECR repo, push the image
aws ecr create-repository --repository-name cevoc-dev

# Deploy infrastructure
./deploy.sh dev my-cfn-bucket --image-uri 123456789.dkr.ecr.ap-southeast-2.amazonaws.com/cevoc-dev:latest
```

Edit `parameters/dev.json` or `parameters/prod.json` with your actual values before deploying. The `CHANGE_ME` placeholders must be replaced:
- `ImageUri` — ECR image URI
- `CertificateArn` — ACM certificate for HTTPS
- `TemplateBaseUrl` — set automatically by `deploy.sh`

## After deploy

1. **Populate secrets:** update the Secrets Manager secret via Console or CLI
2. **DNS:** point your domain to the ALB DNS name (dev) or CloudFront domain (prod)
3. **CI/CD:** the GitHub Actions workflow builds and pushes to ECR, then updates the ECS service

## Security

- No secrets in templates — Secrets Manager references only
- ECS tasks run in private subnets, no public IP
- ALB security group accepts 443 and 80 (redirected) only
- ECS security group accepts 8080 from ALB security group only
- Task role has least-privilege access to Secrets Manager
- ECR images scanned on push

## Environment differences

| Setting | dev | prod |
|---------|-----|------|
| ECS CPU/memory | 1 vCPU / 2 GB | 2 vCPU / 4 GB |
| Desired count | 1 | 2 |
| NAT Gateway | Single | HA (one per AZ) |
| CloudFront | No | Yes |
| Log retention | 14 days | 90 days |
| Container Insights | Off | On |
| SNS alarms | No | Yes |
