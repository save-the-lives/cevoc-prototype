# CEVOC — CloudFront distribution in front of ALB (prod only)

variable "environment" { type = string }
variable "alb_dns_name" { type = string }
variable "certificate_arn" {
  type    = string
  default = ""
}
variable "domain_name" {
  type    = string
  default = ""
}

locals {
  has_domain = var.domain_name != ""
}

resource "aws_cloudfront_distribution" "this" {
  enabled         = true
  comment         = "CEVOC ${var.environment}"
  http_version    = "http2and3"
  price_class     = "PriceClass_100"
  is_ipv6_enabled = true

  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    cache_policy_id          = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AllViewer
  }

  aliases = local.has_domain ? [var.domain_name] : []

  viewer_certificate {
    acm_certificate_arn            = local.has_domain ? var.certificate_arn : null
    ssl_support_method             = local.has_domain ? "sni-only" : null
    minimum_protocol_version       = local.has_domain ? "TLSv1.2_2021" : null
    cloudfront_default_certificate = local.has_domain ? false : true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = { Name = "cevoc-${var.environment}-cf" }
}

output "distribution_id" {
  value = aws_cloudfront_distribution.this.id
}

output "distribution_domain_name" {
  value = aws_cloudfront_distribution.this.domain_name
}
