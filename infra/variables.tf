variable "subscription_id" {
  type        = string
}

variable "client_id" {
  type        = string
}

variable "client_secret" {
  type        = string
  sensitive   = true
}

variable "tenant_id" {
  type        = string

}

variable "location" {
  type        = string
  default     = "Norway East"
}

variable "resource_group_name" {
  type        = string
  default     = "hx-office-manager-rg"
}
