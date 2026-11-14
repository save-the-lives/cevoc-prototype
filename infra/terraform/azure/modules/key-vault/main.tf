variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "this" {
  name                       = var.name
  resource_group_name        = var.resource_group_name
  location                   = var.location
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"
  soft_delete_retention_days = 90
  enable_rbac_authorization  = false
  tags                       = var.tags

  network_acls {
    default_action = "Allow"
    bypass         = "AzureServices"
  }
}

output "vault_uri" {
  value = azurerm_key_vault.this.vault_uri
}

output "vault_id" {
  value = azurerm_key_vault.this.id
}
