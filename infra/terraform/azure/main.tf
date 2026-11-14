# CEVOC — Azure Infrastructure (Terraform/OpenTofu)
# Ported from Bicep (infra/azure/).
#
# Usage:
#   tofu init && tofu plan -var-file=environments/dev.tfvars
#   tofu apply -var-file=environments/dev.tfvars

locals {
  is_prod        = var.environment == "prod"
  spring_profile = var.spring_profile != "" ? var.spring_profile : var.environment
  rg_name        = var.resource_group_name != "" ? var.resource_group_name : "rg-${var.base_name}-${var.environment}"

  tags = {
    project     = "cevoc"
    environment = var.environment
    managedBy   = "terraform"
  }
}

data "azurerm_resource_group" "this" {
  name = local.rg_name
}

resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
  keepers = {
    rg_id = data.azurerm_resource_group.this.id
  }
}

# ---------- Container Registry ----------
module "acr" {
  source   = "./modules/container-registry"
  name     = "${var.base_name}${random_string.suffix.result}acr"
  location = var.location
  sku      = local.is_prod ? "Standard" : "Basic"
  tags     = local.tags
}

# ---------- Monitoring ----------
module "monitoring" {
  source    = "./modules/monitoring"
  base_name = "${var.base_name}-${var.environment}"
  location  = var.location
  tags      = local.tags
}

# ---------- Key Vault ----------
locals {
  kv_name = "${var.base_name}${var.environment}${substr(random_string.suffix.result, 0, 4)}kv"
}

module "kv" {
  source   = "./modules/key-vault"
  name     = local.kv_name
  location = var.location
  tags     = local.tags
}

# ---------- Container App ----------
module "app" {
  source                         = "./modules/container-app"
  base_name                      = "${var.base_name}-${var.environment}"
  location                       = var.location
  tags                           = local.tags
  environment                    = var.environment
  acr_login_server               = module.acr.login_server
  image_tag                      = var.image_tag
  spring_profile                 = local.spring_profile
  key_vault_uri                  = module.kv.vault_uri
  app_insights_connection_string = module.monitoring.app_insights_connection_string
  deploy_blur_worker             = var.deploy_blur_worker
  resource_group_name            = local.rg_name
}

# Grant Container App managed identity access to Key Vault secrets
resource "azurerm_key_vault_access_policy" "app" {
  key_vault_id = module.kv.vault_id
  tenant_id    = module.app.identity_tenant_id
  object_id    = module.app.identity_principal_id

  secret_permissions = ["Get", "List"]
}

# Grant AcrPull to Container App managed identity
resource "azurerm_role_assignment" "acr_pull" {
  scope                = module.acr.registry_id
  role_definition_name = "AcrPull"
  principal_id         = module.app.identity_principal_id
  principal_type       = "ServicePrincipal"
}

# ---------- Front Door (prod only) ----------
module "front_door" {
  source           = "./modules/front-door"
  count            = var.enable_front_door ? 1 : 0
  base_name        = "${var.base_name}-${var.environment}"
  tags             = local.tags
  origin_host_name = module.app.default_host_name
}

# ---------- Outputs ----------
output "app_url" {
  value = "https://${module.app.default_host_name}"
}

output "acr_login_server" {
  value = module.acr.login_server
}

output "key_vault_uri" {
  value = module.kv.vault_uri
}

output "front_door_endpoint" {
  value = var.enable_front_door && length(module.front_door) > 0 ? module.front_door[0].endpoint_host_name : ""
}
