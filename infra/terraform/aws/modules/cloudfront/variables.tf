variable "environment" {
  description = "Environment name"
  type        = string
}

variable "alb_dns_name" {
  description = "ALB DNS name for the backend origin"
  type        = string
}

variable "frontend_bucket_id" {
  description = "S3 bucket ID for frontend static files"
  type        = string
}

variable "frontend_bucket_arn" {
  description = "S3 bucket ARN for frontend static files"
  type        = string
}

variable "frontend_bucket_regional_domain_name" {
  description = "S3 bucket regional domain name for CloudFront origin"
  type        = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN in us-east-1 for custom domain"
  type        = string
  default     = ""
}

variable "domain_name" {
  description = "Custom domain for CloudFront (optional)"
  type        = string
  default     = ""
}
