using '../main.bicep'

param environment = 'dev'
param baseName = 'cevoc'
param location = 'australiaeast'
param springProfile = 'dev'
param imageTag = 'latest'
param enableFrontDoor = false
// Trial subscription workaround: share the live Container Apps environment
// The bootstrap script sets this via --parameters override; leave empty for non-trial subs
param existingContainerAppEnvId = ''
