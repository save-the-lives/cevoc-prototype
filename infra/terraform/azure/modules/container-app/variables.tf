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
  type    = bool
  default = false
}

variable "environment" {
  type = string
}

variable "image_tag" {
  type    = string
  default = "latest"
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
  type    = string
  default = "dev"
}

variable "tags" {
  type = map(string)
}
