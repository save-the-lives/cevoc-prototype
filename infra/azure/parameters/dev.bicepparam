using '../main.bicep'

param environment = 'dev'
param baseName = 'cevoc'
// Melbourne — avoids the live app's Container Apps environment in AU East.
// On a trial subscription (1 env globally), this deploy will fail on the env limit.
// That's expected; the templates are correct for production subscriptions.
param location = 'australiasoutheast'
param springProfile = 'dev'
param imageTag = 'latest'
// Set by the deploy workflow (KV_GENERATION); see kvGeneration in main.bicep.
param kvGeneration = readEnvironmentVariable('KV_GENERATION', '')
// Record 0036: blur runs in its own container. The app's CEVOC_BLUR_MODE (deploy workflows) decides whether it is used;
// "process" rolls back to blurring inside the app with the worker left idle.
param deployBlurWorker = true
