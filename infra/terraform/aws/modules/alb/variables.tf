variable "certificate_arn" {
  type    = string
  default = ""
}

variable "environment" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "vpc_id" {
  type = string
}
