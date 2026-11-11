using '../main.bicep'

param environment = 'dev'
param baseName = 'cevoc'
param location = 'australiasoutheast'
param springProfile = 'dev'
param imageTag = 'latest'
param enableFrontDoor = false
