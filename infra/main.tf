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

resource "azurerm_service_plan" "app_plan" {
  name                = "office-manager-asp"
  resource_group_name = azurerm_resource_group.rg_office_manager.name
  location            = azurerm_resource_group.rg_office_manager.location

  os_type  = "Linux"
  sku_name = "B1" # cheap, fine for now
}

resource "azurerm_linux_web_app" "web_app" {
  name                = "office-manager-app"
  resource_group_name = azurerm_resource_group.rg_office_manager.name
  location            = azurerm_resource_group.rg_office_manager.location
  service_plan_id     = azurerm_service_plan.app_plan.id

  identity {
    type = "SystemAssigned"
  }

  site_config {
    application_stack {
      docker_image_name   = "office-manager:latest"
      docker_registry_url = "https://${azurerm_container_registry.acr.login_server}"
    }

    always_on = true
  }

  app_settings = {
    WEBSITES_ENABLE_APP_SERVICE_STORAGE = "false"
    DOCKER_REGISTRY_SERVER_URL          = "https://${azurerm_container_registry.acr.login_server}"
  }
}

#resource "azurerm_role_assignment" "acr_pull" {
  #scope                = azurerm_container_registry.acr.id
  #role_definition_name = "AcrPull"
  #principal_id         = azurerm_linux_web_app.web_app.identity[0].principal_id
#}
