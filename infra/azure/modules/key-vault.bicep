// Azure Key Vault for secrets management

@description('Key Vault name (3-24 chars, alphanumeric + hyphens)')
@minLength(3)
@maxLength(24)
param name string

param location string
param tags object

@description('Access policies for managed identities')
param accessPolicies array = []

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    enablePurgeProtection: false
    enableRbacAuthorization: false // Using access policies for simplicity
    accessPolicies: accessPolicies
    networkAcls: {
      defaultAction: 'Allow' // Tighten in prod via parameters
      bypass: 'AzureServices'
    }
  }
}

output vaultUri string = kv.properties.vaultUri
output vaultId string = kv.id
