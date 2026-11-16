variable "alb_security_group_id" {
  type = string
}

variable "environment" {
  type = string
}

variable "execution_role_arn" {
  type = string
}

variable "image_uri" {
  type = string
}

variable "log_group_name" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "secret_arn" {
  type = string
}

variable "target_group_arn" {
  type = string
}

variable "task_role_arn" {
  type = string
}

variable "vpc_id" {
  type = string
}
