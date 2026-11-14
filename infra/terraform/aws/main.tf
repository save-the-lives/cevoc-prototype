# CEVOC — AWS Infrastructure (Terraform/OpenTofu)
# Root module: orchestrates all child modules.
#
# Usage:
#   tofu init && tofu plan -var-file=environments/dev.tfvars
#   tofu apply -var-file=environments/dev.tfvars

locals {
  is_prod = var.environment == "prod"
  name    = "cevoc-${var.environment}"
}

# ---------- VPC ----------
module "vpc" {
  source      = "./modules/vpc"
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
}

# ---------- ECR ----------
module "ecr" {
  source      = "./modules/ecr"
  environment = var.environment
}

# ---------- Secrets ----------
module "secrets" {
  source      = "./modules/secrets"
  environment = var.environment
}

# ---------- Monitoring ----------
module "monitoring" {
  source       = "./modules/monitoring"
  environment  = var.environment
  cluster_name = module.ecs.cluster_name
  service_name = module.ecs.service_name
}

# ---------- ALB ----------
module "alb" {
  source            = "./modules/alb"
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  public_subnet_ids = module.vpc.public_subnet_ids
  certificate_arn   = var.certificate_arn
}

# ---------- ECS ----------
module "ecs" {
  source               = "./modules/ecs"
  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  target_group_arn     = module.alb.target_group_arn
  alb_security_group_id = module.alb.alb_security_group_id
  image_uri            = var.image_uri != "" ? var.image_uri : "${module.ecr.repository_uri}:latest"
  task_role_arn        = module.secrets.task_role_arn
  execution_role_arn   = module.secrets.execution_role_arn
  secret_arn           = module.secrets.secret_arn
  log_group_name       = module.monitoring.log_group_name
}

# ---------- CloudFront (prod only) ----------
module "cloudfront" {
  source          = "./modules/cloudfront"
  count           = local.is_prod ? 1 : 0
  environment     = var.environment
  alb_dns_name    = module.alb.alb_dns_name
  certificate_arn = var.cloudfront_certificate_arn
  domain_name     = var.domain_name
}

# ---------- Outputs ----------
output "alb_dns_name" {
  value = module.alb.alb_dns_name
}

output "ecr_repository_uri" {
  value = module.ecr.repository_uri
}

output "cloudfront_domain" {
  value = local.is_prod && length(module.cloudfront) > 0 ? module.cloudfront[0].distribution_domain_name : ""
}
