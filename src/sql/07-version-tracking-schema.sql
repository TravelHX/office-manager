-- Version Tracking Schema
-- This file creates the schema for application version tracking
-- Note: Database is automatically selected by Docker MySQL based on MYSQL_DATABASE env var

-- Version tracking table
CREATE TABLE IF NOT EXISTS app_version (
    id INT AUTO_INCREMENT PRIMARY KEY,
    version_number VARCHAR(20) NOT NULL UNIQUE,
    deployment_info TEXT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_version_number (version_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert initial version if table is empty
INSERT INTO app_version (version_number, deployment_info) 
VALUES ('0.1.0', 'Initial version')
ON DUPLICATE KEY UPDATE version_number = version_number;
