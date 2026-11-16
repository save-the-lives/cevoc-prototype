// Azure Front Door (Standard): ONE public address for the whole app.
//   /api/*  -> the backend Container App
//   /*      -> the Static Web App (frontend)
// With one address the browser never makes a cross-origin call, so there is no CORS to configure and the frontend
// is built with no API address at all (VITE_API_BASE_URL empty).
//
// Deliberate choices:
// - No caching and no compression on either route. API answers must never be cached, and the lookup answer is a
//   stream (Server-Sent Events) that compression would hold back. The Static Web App already caches its own assets.
// - originResponseTimeoutSeconds is 240 (the service allows 16 to 240): a Chromium lookup takes about 45 seconds
//   and a video blur can take two minutes.
// - No WAF policy here. Managed rule sets need the Premium tier; add a policy with the tier when it is wanted.
// - Free Trial and Student subscriptions are reported to be refused Front Door; front-door-trial.yml proves it either way.

param baseName string
param tags object

@description('Backend Container App host name (no scheme). Receives /api/*.')
param apiOriginHostName string

@description('Static Web App host name (no scheme). Receives everything else.')
param siteOriginHostName string

resource profile 'Microsoft.Cdn/profiles@2023-05-01' = {
  name: '${baseName}-fd'
  location: 'global'
  tags: tags
  sku: {
    name: 'Standard_AzureFrontDoor'
  }
  properties: {
    originResponseTimeoutSeconds: 240
  }
}

resource endpoint 'Microsoft.Cdn/profiles/afdEndpoints@2023-05-01' = {
  parent: profile
  name: '${baseName}-ep'
  location: 'global'
  tags: tags
  properties: {
    enabledState: 'Enabled'
  }
}

// ---------- Backend: /api/* ----------
resource apiGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: profile
  name: 'api'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      // /api/ping answers "ok" and touches no adapter or network. There is no actuator in this app.
      probePath: '/api/ping'
      probeRequestType: 'GET'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 120
    }
  }
}

resource apiOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: apiGroup
  name: 'container-app'
  properties: {
    hostName: apiOriginHostName
    httpPort: 80
    httpsPort: 443
    originHostHeader: apiOriginHostName
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

resource apiRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'api'
  properties: {
    originGroup: {
      id: apiGroup.id
    }
    supportedProtocols: ['Https']
    httpsRedirect: 'Disabled'
    forwardingProtocol: 'HttpsOnly'
    patternsToMatch: ['/api/*']
    linkToDefaultDomain: 'Enabled'
  }
  dependsOn: [apiOrigin]
}

// ---------- Frontend: everything else ----------
resource siteGroup 'Microsoft.Cdn/profiles/originGroups@2023-05-01' = {
  parent: profile
  name: 'site'
  properties: {
    loadBalancingSettings: {
      sampleSize: 4
      successfulSamplesRequired: 3
      additionalLatencyInMilliseconds: 50
    }
    healthProbeSettings: {
      probePath: '/'
      probeRequestType: 'HEAD'
      probeProtocol: 'Https'
      probeIntervalInSeconds: 120
    }
  }
}

resource siteOrigin 'Microsoft.Cdn/profiles/originGroups/origins@2023-05-01' = {
  parent: siteGroup
  name: 'static-web-app'
  properties: {
    hostName: siteOriginHostName
    httpPort: 80
    httpsPort: 443
    originHostHeader: siteOriginHostName
    priority: 1
    weight: 1000
    enabledState: 'Enabled'
  }
}

resource siteRoute 'Microsoft.Cdn/profiles/afdEndpoints/routes@2023-05-01' = {
  parent: endpoint
  name: 'site'
  properties: {
    originGroup: {
      id: siteGroup.id
    }
    supportedProtocols: ['Http', 'Https']
    httpsRedirect: 'Enabled'
    forwardingProtocol: 'HttpsOnly'
    patternsToMatch: ['/*']
    linkToDefaultDomain: 'Enabled'
  }
  dependsOn: [siteOrigin, apiRoute]
}

output endpointHostName string = endpoint.properties.hostName
output profileId string = profile.id
