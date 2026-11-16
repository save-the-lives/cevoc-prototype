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

@description('Deploy the blur worker as a separate container app')
param deployBlurWorker bool = false

@description('Deploy the browser (Chromium) worker. Built but dormant — scales to zero, wakes on first browser-route lookup.')
param deployBrowserWorker bool = false

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
// Changes after each teardown (owner direction 2026-11-17): a deleted vault keeps its name for 90 days and purging it
// needs a subscription-wide right the deploy identity must not have. The deploy workflow passes the generation of the
// vault already in the group, or a new one when the group is empty. Empty = the original name.
@maxLength(6)
param kvGeneration string = ''
var kvName = '${baseName}${environment}${take(uniqueSuffix, 4)}${kvGeneration}kv'  // max 24 chars, unique per env
module kv 'modules/key-vault.bicep' = {
  name: 'kv-${environment}'
  params: {
    name: kvName
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
    deployBrowserWorker: deployBrowserWorker
  }
}

// Grant Container App managed identity access to Key Vault
module kvAccess 'modules/key-vault.bicep' = {
  name: 'kv-access-${environment}'
  params: {
    name: kvName
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

// ---------- Outputs ----------
output appUrl string = 'https://${app.outputs.defaultHostName}'
output acrLoginServer string = acr.outputs.loginServer
output keyVaultUri string = kv.outputs.vaultUri
output browserWorkerFqdn string = deployBrowserWorker ? app.outputs.browserWorkerFqdn : ''
