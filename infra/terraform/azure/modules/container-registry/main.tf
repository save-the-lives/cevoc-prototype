variable "name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "sku" {
  type    = string
  default = "Basic"
}
variable "tags" { type = map(string) }

resource "azurerm_container_registry" "this" {
  name                = var.name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.sku
  admin_enabled       = false
  tags                = var.tags
}

output "login_server" {
  value = azurerm_container_registry.this.login_server
}

output "registry_id" {
  value = azurerm_container_registry.this.id
}
