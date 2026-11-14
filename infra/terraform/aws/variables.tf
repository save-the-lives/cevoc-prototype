variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-southeast-2" # Sydney
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "image_uri" {
  description = "Full ECR image URI (account.dkr.ecr.region.amazonaws.com/repo:tag)"
  type        = string
  default     = "" # Empty on first deploy; ECR created first
}

variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS (ALB)"
  type        = string
  default     = ""
}

variable "cloudfront_certificate_arn" {
  description = "ACM certificate ARN in us-east-1 (CloudFront, prod only)"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain for CloudFront (optional)"
  type        = string
  default     = ""
}
