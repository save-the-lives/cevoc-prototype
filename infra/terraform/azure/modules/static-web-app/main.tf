# Azure Static Web App — hosts the CEVOC frontend (React/Vite SPA).
# The actual deployment of built files is handled by CI/CD using the
# Azure/static-web-apps-deploy GitHub Action with the API token from this resource.

resource "azurerm_static_web_app" "frontend" {
  name                = "${var.base_name}-${var.environment}-swa"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku_tier            = "Free"
  sku_size            = "Free"
  tags                = var.tags
}

# ---------- Outputs ----------
output "default_hostname" {
  value       = azurerm_static_web_app.frontend.default_host_name
  description = "Default hostname of the Static Web App"
}

output "name" {
  value       = azurerm_static_web_app.frontend.name
  description = "Name of the Static Web App resource"
}

output "id" {
  value       = azurerm_static_web_app.frontend.id
  description = "Resource ID of the Static Web App"
}

output "api_key" {
  value       = azurerm_static_web_app.frontend.api_key
  description = "API key for deploying to the Static Web App (use as secret in CI)"
  sensitive   = true
}
