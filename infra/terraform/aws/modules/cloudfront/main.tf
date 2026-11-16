# CEVOC — CloudFront in front of the one container (ALB). The container serves both the site and the API on one address
# (record 0031), so there is one origin and nothing is cached: API answers must never be cached, and the lookup answer is
# a stream. Same shape as infra/aws/cloudfront.yaml.

# Variables are in variables.tf (they were declared twice before, which terraform validate refuses).

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
    compress               = false

    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingDisabled
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # Managed-AllViewer
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

output "distribution_arn" {
  value = aws_cloudfront_distribution.this.arn
}
