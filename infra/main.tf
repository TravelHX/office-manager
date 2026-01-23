resource "azurerm_resource_group" "rg_office_manager" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.rg_office_manager.name
  location            = azurerm_resource_group.rg_office_manager.location

  sku           = "Basic"
  admin_enabled = true
}
