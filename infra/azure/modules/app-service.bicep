// App Service Plan + Web App (Linux container)

param baseName string
param location string
param tags object

@allowed(['dev', 'staging', 'prod'])
param environment string

param acrLoginServer string
param imageTag string = 'latest'
param springProfile string = 'dev'
param keyVaultUri string
param appInsightsConnectionString string

// Plan sizing by environment
var planSku = environment == 'prod' ? {
  name: 'P1v3'
  tier: 'PremiumV3'
  capacity: 1
} : {
  name: 'B1'
  tier: 'Basic'
  capacity: 1
}

resource plan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${baseName}-plan'
  location: location
  tags: tags
  kind: 'linux'
  properties: {
    reserved: true // Linux
  }
  sku: {
    name: planSku.name
    tier: planSku.tier
    capacity: planSku.capacity
  }
}

resource app 'Microsoft.Web/sites@2023-01-01' = {
  name: '${baseName}-app'
  location: location
  tags: tags
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrLoginServer}/cevoc:${imageTag}'
      acrUseManagedIdentityCreds: true
      alwaysOn: environment != 'dev'
      http20Enabled: true
      minTlsVersion: '1.2'
      healthCheckPath: '/actuator/health'
      appSettings: [
        { name: 'WEBSITES_PORT', value: '8080' }
        { name: 'SPRING_PROFILES_ACTIVE', value: springProfile }
        { name: 'AZURE_KEY_VAULT_URI', value: keyVaultUri }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
        { name: 'DOCKER_REGISTRY_SERVER_URL', value: 'https://${acrLoginServer}' }
        { name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE', value: 'false' }
        { name: 'DOCKER_ENABLE_CI', value: 'true' } // Continuous deployment webhook
      ]
    }
  }
}

output defaultHostName string = app.properties.defaultHostName
output identityPrincipalId string = app.identity.principalId
output identityTenantId string = app.identity.tenantId
output appId string = app.id
