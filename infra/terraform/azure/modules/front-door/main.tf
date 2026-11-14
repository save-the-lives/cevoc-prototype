variable "base_name" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }
variable "origin_host_name" { type = string }

resource "azurerm_cdn_frontdoor_profile" "this" {
  name                = "${var.base_name}-fd"
  resource_group_name = var.resource_group_name
  sku_name            = "Standard_AzureFrontDoor"
  tags                = var.tags
}

resource "azurerm_cdn_frontdoor_endpoint" "this" {
  name                     = "${var.base_name}-ep"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.this.id
  tags                     = var.tags
}

resource "azurerm_cdn_frontdoor_origin_group" "this" {
  name                     = "app-origins"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.this.id
  session_affinity_enabled = false

  load_balancing {
    sample_size                        = 4
    successful_samples_required        = 3
    additional_latency_in_milliseconds = 50
  }

  health_probe {
    path                = "/actuator/health"
    request_type        = "GET"
    protocol            = "Https"
    interval_in_seconds = 60
  }
}

resource "azurerm_cdn_frontdoor_origin" "this" {
  name                          = "app-service"
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.this.id
  host_name                     = var.origin_host_name
  http_port                     = 80
  https_port                    = 443
  origin_host_header            = var.origin_host_name
  priority                      = 1
  weight                        = 1000
  enabled                       = true

  certificate_name_check_enabled = true
}

resource "azurerm_cdn_frontdoor_route" "this" {
  name                          = "default-route"
  cdn_frontdoor_endpoint_id     = azurerm_cdn_frontdoor_endpoint.this.id
  cdn_frontdoor_origin_group_id = azurerm_cdn_frontdoor_origin_group.this.id
  cdn_frontdoor_origin_ids      = [azurerm_cdn_frontdoor_origin.this.id]
  supported_protocols           = ["Https"]
  https_redirect_enabled        = true
  forwarding_protocol           = "HttpsOnly"
  patterns_to_match             = ["/*"]
  link_to_default_domain        = true

  cache {
    query_string_caching_behavior = "IgnoreQueryString"
    compression_enabled           = true
    content_types_to_compress = [
      "text/html",
      "text/css",
      "application/javascript",
      "application/json",
      "image/svg+xml",
    ]
  }
}

# WAF policy
resource "azurerm_cdn_frontdoor_firewall_policy" "this" {
  name                = replace("${var.base_name}waf", "-", "")
  resource_group_name = var.resource_group_name
  sku_name            = azurerm_cdn_frontdoor_profile.this.sku_name
  mode                = "Detection"
  tags                = var.tags

  managed_rule {
    type    = "Microsoft_DefaultRuleSet"
    version = "2.1"
    action  = "Block"
  }
}

resource "azurerm_cdn_frontdoor_security_policy" "this" {
  name                     = "${var.base_name}-sec"
  cdn_frontdoor_profile_id = azurerm_cdn_frontdoor_profile.this.id

  security_policies {
    firewall {
      cdn_frontdoor_firewall_policy_id = azurerm_cdn_frontdoor_firewall_policy.this.id

      association {
        domain {
          cdn_frontdoor_domain_id = azurerm_cdn_frontdoor_endpoint.this.id
        }
        patterns_to_match = ["/*"]
      }
    }
  }
}

output "endpoint_host_name" {
  value = azurerm_cdn_frontdoor_endpoint.this.host_name
}

output "profile_id" {
  value = azurerm_cdn_frontdoor_profile.this.id
}
