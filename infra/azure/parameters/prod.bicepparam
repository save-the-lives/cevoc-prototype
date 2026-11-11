using '../main.bicep'

param environment = 'prod'
param baseName = 'cevoc'
param springProfile = 'prod'
param imageTag = 'latest'
param enableFrontDoor = true
