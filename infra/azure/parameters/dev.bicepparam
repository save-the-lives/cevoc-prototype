using '../main.bicep'

param environment = 'dev'
param baseName = 'cevoc'
// Melbourne — avoids the live app's Container Apps environment in AU East.
// On a trial subscription (1 env globally), this deploy will fail on the env limit.
// That's expected; the templates are correct for production subscriptions.
param location = 'australiasoutheast'
param springProfile = 'dev'
param imageTag = 'latest'
param enableFrontDoor = false
