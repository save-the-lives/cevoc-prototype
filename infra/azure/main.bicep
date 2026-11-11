// CEVOC Prototype — Azure Infrastructure (Container Apps)
// Orchestrator: deploys all modules for a given environment.
// Usage: az deployment group create -g <rg> -f main.bicep -p parameters/dev.bicepparam

targetScope = 'resourceGroup'

@description('Environment name')
@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Azure region for all resources')
param location string = resourceGroup().location

@description('Base name prefix for resources (lowercase, no hyphens)')
@minLength(3)
@maxLength(12)
param baseName string = 'cevoc'

@description('Spring profile to activate')
param springProfile string = environment

@description('Container image tag to deploy')
param imageTag string = 'latest'

@description('Enable Azure Front Door (recommended for prod)')
param enableFrontDoor bool = environment == 'prod'

@description('Deploy the blur worker as a separate container app')
param deployBlurWorker bool = false

@description('Existing Container Apps environment resource ID. Set this on trial subscriptions that allow only 1 environment globally. The dev app deploys into the existing environment instead of creating a new one.')
param existingContainerAppEnvId string = ''

// Unique suffix for globally unique resource names (ACR, Key Vault)
var uniqueSuffix = uniqueString(resourceGroup().id)

// ---------- Tags ----------
var tags = {
  project: 'cevoc'
  environment: environment
  managedBy: 'bicep'
}

// ---------- Container Registry ----------
module acr 'modules/container-registry.bicep' = {
  name: 'acr-${environment}'
  params: {
    name: '${baseName}${uniqueSuffix}acr'
    location: location
    sku: environment == 'prod' ? 'Standard' : 'Basic'
    tags: tags
  }
}

// ---------- Monitoring ----------
module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring-${environment}'
  params: {
    baseName: '${baseName}-${environment}'
    location: location
    tags: tags
  }
}

// ---------- Key Vault ----------
module kv 'modules/key-vault.bicep' = {
  name: 'kv-${environment}'
  params: {
    name: '${baseName}-${uniqueSuffix}-kv'
    location: location
    tags: tags
  }
}

// ---------- Container App ----------
module app 'modules/container-app.bicep' = {
  name: 'app-${environment}'
  params: {
    baseName: '${baseName}-${environment}'
    location: location
    tags: tags
    environment: environment
    acrLoginServer: acr.outputs.loginServer
    imageTag: imageTag
    springProfile: springProfile
    keyVaultUri: kv.outputs.vaultUri
    appInsightsConnectionString: monitoring.outputs.appInsightsConnectionString
    deployBlurWorker: deployBlurWorker
    existingEnvironmentId: existingContainerAppEnvId
  }
}

// Grant Container App managed identity access to Key Vault
module kvAccess 'modules/key-vault.bicep' = {
  name: 'kv-access-${environment}'
  params: {
    name: '${baseName}-${uniqueSuffix}-kv'
    location: location
    tags: tags
    accessPolicies: [
      {
        tenantId: app.outputs.identityTenantId
        objectId: app.outputs.identityPrincipalId
        permissions: {
          secrets: ['get', 'list']
        }
      }
    ]
  }
}

// Grant Container App AcrPull on the registry
module acrPull 'modules/container-registry.bicep' = {
  name: 'acr-pull-${environment}'
  params: {
    name: '${baseName}${uniqueSuffix}acr'
    location: location
    sku: environment == 'prod' ? 'Standard' : 'Basic'
    tags: tags
    acrPullPrincipalId: app.outputs.identityPrincipalId
  }
}

// ---------- Front Door (prod only) ----------
module frontDoor 'modules/front-door.bicep' = if (enableFrontDoor) {
  name: 'frontdoor-${environment}'
  params: {
    baseName: '${baseName}-${environment}'
    tags: tags
    originHostName: app.outputs.defaultHostName
  }
}

// ---------- Outputs ----------
output appUrl string = 'https://${app.outputs.defaultHostName}'
output acrLoginServer string = acr.outputs.loginServer
output keyVaultUri string = kv.outputs.vaultUri
output frontDoorEndpoint string = enableFrontDoor ? frontDoor.outputs.endpointHostName : ''
