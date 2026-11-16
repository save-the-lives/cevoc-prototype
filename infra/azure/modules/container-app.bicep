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

@description('Deploy the browser (Chromium) worker as a separate container app. Built but dormant: scales to zero, wakes on first browser-route lookup. Failure is a warning unless the config selects the browser adapter.')
param deployBrowserWorker bool = false

// ---------- Sizing ----------
// Lean image still carries Python + OpenCV for blur (until QueueBlurAdapter is default).
// 2 CPU / 4Gi everywhere until Python is fully split out.
var cpuCores = '2.0'
var memoryGi = '4Gi'
var minReplicas = environment == 'prod' ? 1 : 1
var maxReplicas = environment == 'prod' ? 3 : 1
var workerCpu = '1.0'
var workerMemory = '2Gi'
// Browser worker: Chromium is heavy — needs 2 CPU / 4Gi
var browserWorkerCpu = '2.0'
var browserWorkerMemory = '4Gi'

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
resource env 'Microsoft.App/managedEnvironments@2023-05-01' = {
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

// ---------- Backend Container App ----------
resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${baseName}-app'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
        transport: 'http'
        allowInsecure: false
      }
      registries: imageTag != 'latest' ? [
        {
          server: acrLoginServer
          identity: 'system'
        }
      ] : []
    }
    template: {
      containers: [
        {
          name: 'cevoc-backend'
          // Use Microsoft's quickstart image until the real image is pushed to ACR
          image: imageTag == 'latest' ? 'mcr.microsoft.com/k8se/quickstart:latest' : '${acrLoginServer}/cevoc:${imageTag}'
          resources: {
            cpu: json(cpuCores)
            memory: memoryGi
          }
          env: imageTag != 'latest' ? [
            { name: 'SPRING_PROFILES_ACTIVE', value: springProfile }
            { name: 'AZURE_KEY_VAULT_URI', value: keyVaultUri }
            { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsightsConnectionString }
            { name: 'CEVOC_DEMO_DATA_ENABLED', value: 'true' }
            { name: 'SERVER_PORT', value: '8080' }
          ] : []
          probes: imageTag != 'latest' ? [
            {
              type: 'Liveness'
              httpGet: {
                path: '/actuator/health'
                port: 8080
              }
              // Lean JVM image starts in ~30-60s, but allow headroom.
              initialDelaySeconds: 60
              periodSeconds: 30
              failureThreshold: 5
            }
            {
              type: 'Startup'
              httpGet: {
                path: '/actuator/health'
                port: 8080
              }
              // Startup probe runs first; liveness/readiness don't start until it passes.
              // 18 × 10s = 3 min window for the lean JVM image.
              initialDelaySeconds: 10
              periodSeconds: 10
              failureThreshold: 18
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
          ] : []
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
    managedEnvironmentId: env.id
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

// ---------- Browser Worker Container App (optional, scale-to-zero) ----------
// Built but dormant: CI always builds the image, but the worker only starts on the first
// browser-route lookup. If the config doesn't select the browser adapter, a failure here
// is a warning, not a deploy blocker.
resource browserWorker 'Microsoft.App/containerApps@2023-05-01' = if (deployBrowserWorker) {
  name: '${baseName}-browser-worker'
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        // Internal only — the backend calls this worker via its internal FQDN
        external: false
        targetPort: 8080
        transport: 'http'
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
          name: 'browser-worker'
          image: '${acrLoginServer}/cevoc-browser-worker:${imageTag}'
          resources: {
            cpu: json(browserWorkerCpu)
            memory: browserWorkerMemory
          }
          env: [
            { name: 'SPRING_PROFILES_ACTIVE', value: springProfile }
            { name: 'SERVER_PORT', value: '8080' }
          ]
          probes: [
            {
              type: 'Startup'
              httpGet: {
                path: '/actuator/health'
                port: 8080
              }
              // Chromium takes a long time to start: 30 × 10s = 5 min window
              initialDelaySeconds: 10
              periodSeconds: 10
              failureThreshold: 30
            }
            {
              type: 'Liveness'
              httpGet: {
                path: '/actuator/health'
                port: 8080
              }
              initialDelaySeconds: 180
              periodSeconds: 30
              failureThreshold: 5
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
        // Scale to zero: the worker only runs when the backend sends a request
        minReplicas: 0
        maxReplicas: 1
        rules: [
          {
            name: 'http-rule'
            http: {
              metadata: {
                concurrentRequests: '5'
              }
            }
          }
        ]
      }
    }
  }
}

// ---------- Outputs ----------
output defaultHostName string = app.properties.configuration.ingress.fqdn
output identityPrincipalId string = app.identity.principalId
output identityTenantId string = tenant().tenantId
output appId string = app.id
output environmentId string = env.id
output blurWorkerPrincipalId string = deployBlurWorker ? blurWorker.identity.principalId : ''
output browserWorkerPrincipalId string = deployBrowserWorker ? browserWorker.identity.principalId : ''
output browserWorkerFqdn string = deployBrowserWorker ? browserWorker.properties.configuration.ingress.fqdn : ''
