using '../main.bicep'

param environment = 'prod'
param baseName = 'cevoc'
param springProfile = 'prod'
param imageTag = 'latest'
// Set by the deploy workflow (KV_GENERATION); see kvGeneration in main.bicep.
param kvGeneration = readEnvironmentVariable('KV_GENERATION', '')
