-- Phase 12: Enhanced User Management Migration
-- Adds user profile fields: first_name, last_name, email (already exists), office_location, is_admin
-- Adds password reset fields: reset_token, reset_token_expiry
--
-- Note: For fresh databases, these columns are already created by 02-schema.sql.
-- This migration exists for legacy databases created before 02-schema.sql was updated.
-- It uses INFORMATION_SCHEMA to remain idempotent on MySQL 8.0 (which does not support
-- IF NOT EXISTS on ADD COLUMN).

DROP PROCEDURE IF EXISTS add_user_profile_columns;
DELIMITER //
CREATE PROCEDURE add_user_profile_columns()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'first_name') THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(100) NULL AFTER username;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'last_name') THEN
        ALTER TABLE users ADD COLUMN last_name VARCHAR(100) NULL AFTER first_name;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'office_location') THEN
        ALTER TABLE users ADD COLUMN office_location VARCHAR(50) NULL AFTER email;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'is_admin') THEN
        ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE AFTER office_location;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_token') THEN
        ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) NULL AFTER password_hash;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'reset_token_expiry') THEN
        ALTER TABLE users ADD COLUMN reset_token_expiry TIMESTAMP NULL AFTER reset_token;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_is_admin') THEN
        CREATE INDEX idx_is_admin ON users(is_admin);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_reset_token') THEN
        CREATE INDEX idx_reset_token ON users(reset_token);
    END IF;
END //
DELIMITER ;

CALL add_user_profile_columns();
DROP PROCEDURE add_user_profile_columns;

-- Migrate existing role='admin' to is_admin=true
UPDATE users SET is_admin = TRUE WHERE role = 'admin' AND (is_admin IS NULL OR is_admin = FALSE);
