
resource "random_password" "db_password" {
  length           = 16
  special          = true
  
}


resource "azurerm_mysql_flexible_server" "office-manager-dbserver" {
  name                = "office-manager-mysql"
  resource_group_name = azurerm_resource_group.rg_office_manager.name
  location            = azurerm_resource_group.rg_office_manager.location
  administrator_login = "dbadmin"
  administrator_password = random_password.db_password.result

  sku_name            = "B_Standard_B1ms"
  availability_zone   = "2" 
 
}


resource "azurerm_mysql_flexible_database" "office-manager-db" {
  name      = "office_manager"
  resource_group_name = azurerm_resource_group.rg_office_manager.name
  server_name = azurerm_mysql_flexible_server.office-manager-dbserver.name

  charset   = "utf8"
  collation = "utf8_general_ci"
}


resource "azurerm_mysql_flexible_server_firewall_rule" "app_access" {
  name       = "allow-app-service"
  resource_group_name = azurerm_resource_group.rg_office_manager.name
  server_name = azurerm_mysql_flexible_server.office-manager-dbserver.name
  start_ip_address = "0.0.0.0"    # For testing only
  end_ip_address   = "255.255.255.255"
}


output "db_host" {
  value = azurerm_mysql_flexible_server.office-manager-dbserver.fqdn
}

output "db_user" {
  value = azurerm_mysql_flexible_server.office-manager-dbserver.administrator_login
}

output "db_password" {
  value     = random_password.db_password.result
  sensitive = true
}

output "db_name" {
  value = azurerm_mysql_flexible_database.office-manager-db.name
}
