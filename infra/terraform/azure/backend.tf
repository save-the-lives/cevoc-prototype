# Backend configuration — passed at init time via -backend-config.
# One state file per environment; never share state across envs.
#
# For local development without remote state:
#   terraform init -backend=false
#
# For CI/CD with Azure Blob Storage:
#   terraform init \
#     -backend-config="storage_account_name=<sa>" \
#     -backend-config="container_name=tfstate" \
#     -backend-config="key=cevoc-<env>.tfstate" \
#     -backend-config="resource_group_name=rg-cevoc-tfstate"
#
# terraform {
#   backend "azurerm" {}
# }
