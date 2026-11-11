// Azure Container Apps — managed environment + container app
// Replaces App Service for the CEVOC backend.

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

@description('Deploy the blur worker as a separate container app')
param deployBlurWorker bool = false

@description('Existing Container Apps environment ID. When set, skips creating a new environment (use for trial subscriptions with a 1-env limit).')
param existingEnvironmentId string = ''

// ---------- Sizing ----------
var cpuCores = environment == 'prod' ? '2.0' : '1.0'
var memoryGi = environment == 'prod' ? '4Gi' : '2Gi'
var minReplicas = environment == 'prod' ? 1 : 0
var maxReplicas = environment == 'prod' ? 3 : 1
var workerCpu = '1.0'
var workerMemory = '2Gi'

// ---------- Log Analytics (required for managed environment) ----------
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${baseName}-logs'
  location: location
  tags: tags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: environment == 'prod' ? 90 : 30
  }
}

// ---------- Managed Environment ----------
// Skip creating if an existing environment ID is provided (trial sub workaround)
resource env 'Microsoft.App/managedEnvironments@2023-05-01' = if (existingEnvironmentId == '') {
  name: '${baseName}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

var envId = existingEnvironmentId != '' ? existingEnvironmentId : env.id

// ---------- Backend Container App ----------
resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${baseName}-app'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: envId
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
      }
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'cevoc-backend'
          image: '${acrLoginServer}/cevoc:${imageTag}'
          resources: {
            cpu: json(cpuCores)
            memory: memoryGi
          }
          env: [
            { name: 'SPRING_PROFILES_ACTIVE', value: springProfile }
            { name: 'AZURE_KEY_VAULT_URI', value: keyVaultUri }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'CEVOC_DEMO_DATA_ENABLED', value: 'true' }
            { name: 'SERVER_PORT', value: '8080' }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/actuator/health'
                port: 8080
              }
              initialDelaySeconds: 30
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/actuator/health'
                port: 8080
              }
              initialDelaySeconds: 10
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '20'
              }
            }
          }
        ]
      }
    }
  }
}

// ---------- Blur Worker Container App (optional) ----------
resource blurWorker 'Microsoft.App/containerApps@2023-05-01' = if (deployBlurWorker) {
  name: '${baseName}-blur-worker'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: envId
    configuration: {
      registries: [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ]
      // No ingress — worker pulls from queue, not HTTP
    }
    template: {
      containers: [
        {
          name: 'blur-worker'
          image: '${acrLoginServer}/cevoc-blur-worker:${imageTag}'
          resources: {
            cpu: json(workerCpu)
            memory: workerMemory
          }
          env: [
            { name: 'QUEUE_TYPE', value: 'redis' }
            // REDIS_URL injected via Key Vault secret ref at deploy time
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

// ---------- Outputs ----------
output defaultHostName string = app.properties.configuration.ingress.fqdn
output identityPrincipalId string = app.identity.principalId
output identityTenantId string = tenant().tenantId
output appId string = app.id
output environmentId string = envId
output blurWorkerPrincipalId string = deployBlurWorker ? blurWorker.identity.principalId : ''
