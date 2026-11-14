variable "environment" {
  description = "Environment name"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "australiasoutheast"
}

variable "base_name" {
  description = "Base name prefix for resources"
  type        = string
  default     = "cevoc"
}

variable "image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "latest"
}

variable "spring_profile" {
  description = "Spring profile to activate"
  type        = string
  default     = ""
}

variable "enable_front_door" {
  description = "Enable Azure Front Door (recommended for prod)"
  type        = bool
  default     = false
}

variable "deploy_blur_worker" {
  description = "Deploy the blur worker as a separate container app"
  type        = bool
  default     = false
}

variable "resource_group_name" {
  description = "Resource group name (must pre-exist via bootstrap)"
  type        = string
  default     = ""
}
