variable "base_name" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "tags" { type = map(string) }

resource "azurerm_log_analytics_workspace" "this" {
  name                = "${var.base_name}-logs"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_application_insights" "this" {
  name                = "${var.base_name}-insights"
  resource_group_name = var.resource_group_name
  location            = var.location
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.this.id
  tags                = var.tags
}

output "app_insights_connection_string" {
  value = azurerm_application_insights.this.connection_string
}

output "app_insights_instrumentation_key" {
  value = azurerm_application_insights.this.instrumentation_key
}

output "log_analytics_id" {
  value = azurerm_log_analytics_workspace.this.id
}
