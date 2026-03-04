-- Phase 12: Enhanced User Management Migration
-- Adds user profile fields: first_name, last_name, email (already exists), office_location, is_admin
-- Adds password reset fields: reset_token, reset_token_expiry
-- Note: This migration uses MySQL 8.0.19+ IF NOT EXISTS syntax for ADD COLUMN
-- For older MySQL versions, run this migration manually and handle column existence errors

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL AFTER username,
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL AFTER first_name,
ADD COLUMN IF NOT EXISTS office_location VARCHAR(50) NULL AFTER email,
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE AFTER office_location,
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL AFTER password_hash,
ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP NULL AFTER reset_token;

-- Create index on is_admin for faster admin queries
CREATE INDEX IF NOT EXISTS idx_is_admin ON users(is_admin);

-- Create index on reset_token for password reset lookups
CREATE INDEX IF NOT EXISTS idx_reset_token ON users(reset_token);

-- Migrate existing role='admin' to is_admin=true
UPDATE users SET is_admin = TRUE WHERE role = 'admin' AND (is_admin IS NULL OR is_admin = FALSE);
