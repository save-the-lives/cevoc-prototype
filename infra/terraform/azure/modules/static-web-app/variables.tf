variable "base_name" {
  type        = string
  description = "Base name prefix for resources"
}

variable "location" {
  type        = string
  description = "Azure region"
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}

variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group"
}
