// Azure Container Registry

@description('Registry name (lowercase alphanumeric, globally unique)')
@minLength(5)
@maxLength(50)
param name string

param location string
param tags object

@allowed(['Basic', 'Standard', 'Premium'])
param sku string = 'Basic'

@description('Principal ID to grant AcrPull role (optional)')
param acrPullPrincipalId string = ''

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

// AcrPull role assignment for App Service managed identity
var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d' // AcrPull built-in role

resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(acrPullPrincipalId)) {
  name: guid(acr.id, acrPullPrincipalId, acrPullRoleId)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
    principalId: acrPullPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output loginServer string = acr.properties.loginServer
output registryId string = acr.id
