// Azure Static Web App — hosts the CEVOC frontend (React/Vite SPA).
// Deployed from CI via the Azure/static-web-apps-deploy action, not linked to GitHub.

param baseName string
param location string
param tags object

@allowed(['dev', 'staging', 'prod'])
param environment string

@description('Backend API origin the frontend calls (baked into the build as VITE_API_BASE_URL)')
param backendOrigin string = ''

resource swa 'Microsoft.Web/staticSites@2022-09-01' = {
  name: '${baseName}-swa'
  location: location
  tags: tags
  sku: {
    name: environment == 'prod' ? 'Standard' : 'Free'
    tier: environment == 'prod' ? 'Standard' : 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      skipGithubActionWorkflowGeneration: true
    }
  }
}

// ---------- Outputs ----------
output defaultHostname string = swa.properties.defaultHostname
output name string = swa.name
output id string = swa.id
