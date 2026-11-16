variable "acr_login_server" {
  type = string
}

variable "app_insights_connection_string" {
  type = string
}

variable "base_name" {
  type = string
}

variable "deploy_blur_worker" {
  type = bool
}

variable "environment" {
  type = string
}

variable "image_tag" {
  type = string
}

variable "key_vault_uri" {
  type = string
}

variable "location" {
  type = string
}

variable "resource_group_name" {
  type = string
}

variable "spring_profile" {
  type = string
}

variable "tags" {
  type = map(string)
}
