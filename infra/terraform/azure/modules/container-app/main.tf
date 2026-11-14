variable "base_name" { type = string }
variable "location" { type = string }
variable "tags" { type = map(string) }
variable "environment" { type = string }
variable "acr_login_server" { type = string }
variable "image_tag" {
  type    = string
  default = "latest"
}
variable "spring_profile" {
  type    = string
  default = "dev"
}
variable "key_vault_uri" { type = string }
variable "app_insights_connection_string" { type = string }
variable "deploy_blur_worker" {
  type    = bool
  default = false
}
variable "resource_group_name" { type = string }

locals {
  is_prod      = var.environment == "prod"
  cpu_cores    = local.is_prod ? 2.0 : 1.0
  memory_gi    = local.is_prod ? "4Gi" : "2Gi"
  min_replicas = local.is_prod ? 1 : 0
  max_replicas = local.is_prod ? 3 : 1
  use_placeholder = var.image_tag == "latest"
}

# Log Analytics for the managed environment
resource "azurerm_log_analytics_workspace" "env" {
  name                = "${var.base_name}-env-logs"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = local.is_prod ? 90 : 30
  tags                = var.tags
}

# Container Apps managed environment
resource "azurerm_container_app_environment" "this" {
  name                       = "${var.base_name}-env"
  resource_group_name        = var.resource_group_name
  location                   = var.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.env.id
  tags                       = var.tags
}

# Backend container app
resource "azurerm_container_app" "backend" {
  name                         = "${var.base_name}-app"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type = "SystemAssigned"
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "http"

    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  # Registry config only when using real image
  dynamic "registry" {
    for_each = local.use_placeholder ? [] : [1]
    content {
      server   = var.acr_login_server
      identity = "system"
    }
  }

  template {
    min_replicas = local.min_replicas
    max_replicas = local.max_replicas

    container {
      name   = "cevoc-backend"
      image  = local.use_placeholder ? "mcr.microsoft.com/k8se/quickstart:latest" : "${var.acr_login_server}/cevoc:${var.image_tag}"
      cpu    = local.cpu_cores
      memory = local.memory_gi

      # Env vars only for real image
      dynamic "env" {
        for_each = local.use_placeholder ? [] : [
          { name = "SPRING_PROFILES_ACTIVE", value = var.spring_profile },
          { name = "AZURE_KEY_VAULT_URI", value = var.key_vault_uri },
          { name = "APPLICATIONINSIGHTS_CONNECTION_STRING", value = var.app_insights_connection_string },
          { name = "CEVOC_DEMO_DATA_ENABLED", value = "true" },
          { name = "SERVER_PORT", value = "8080" },
        ]
        content {
          name  = env.value.name
          value = env.value.value
        }
      }

      # Probes only for real image
      dynamic "liveness_probe" {
        for_each = local.use_placeholder ? [] : [1]
        content {
          transport             = "HTTP"
          path                  = "/actuator/health"
          port                  = 8080
          initial_delay         = 30
          interval_seconds      = 30
        }
      }

      dynamic "readiness_probe" {
        for_each = local.use_placeholder ? [] : [1]
        content {
          transport             = "HTTP"
          path                  = "/actuator/health"
          port                  = 8080
          initial_delay         = 10
          interval_seconds      = 10
        }
      }
    }
  }
}

# Blur worker (optional)
resource "azurerm_container_app" "blur_worker" {
  count                        = var.deploy_blur_worker ? 1 : 0
  name                         = "${var.base_name}-blur-worker"
  container_app_environment_id = azurerm_container_app_environment.this.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"
  tags                         = var.tags

  identity {
    type = "SystemAssigned"
  }

  registry {
    server   = var.acr_login_server
    identity = "system"
  }

  template {
    min_replicas = 0
    max_replicas = 1

    container {
      name   = "blur-worker"
      image  = "${var.acr_login_server}/cevoc-blur-worker:${var.image_tag}"
      cpu    = 1.0
      memory = "2Gi"

      env {
        name  = "QUEUE_TYPE"
        value = "redis"
      }
    }
  }
}

output "default_host_name" {
  value = azurerm_container_app.backend.ingress[0].fqdn
}

output "identity_principal_id" {
  value = azurerm_container_app.backend.identity[0].principal_id
}

output "identity_tenant_id" {
  value = azurerm_container_app.backend.identity[0].tenant_id
}

output "app_id" {
  value = azurerm_container_app.backend.id
}

output "environment_id" {
  value = azurerm_container_app_environment.this.id
}
