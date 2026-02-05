terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.75"
    }
  }
  required_version = ">= 1.5"
  backend "azurerm" {
    resource_group_name  = "hx-office-manager-sa"
    storage_account_name = "tfstateofficemanagersa"
    container_name       = "tfstate"
    key                  = "terraform.tfstate"
  }
}

provider "azurerm" {
  features {}

  
}
