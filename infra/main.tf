resource "azurerm_resource_group" "rg_office_manager" {
  name     = var.resource_group_name
  location = var.location
}
