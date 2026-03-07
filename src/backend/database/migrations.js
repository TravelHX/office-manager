const { executeQuery } = require('./connection');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Run database migrations to ensure schema is up to date
 * This ensures that columns added in later schema versions are present
 */
async function runMigrations() {
  logger.info('Checking database schema migrations...');

  try {
    // Check if first_name column exists
    const checkColumnQuery = `
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'first_name'
    `;

    const result = await executeQuery(checkColumnQuery);
    const columnExists = result[0]?.count > 0;

    if (!columnExists) {
      logger.info('first_name column missing - running migration...');
      
      // Run the migration SQL
      const migrationSQL = `
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL AFTER username,
        ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL AFTER first_name,
        ADD COLUMN IF NOT EXISTS office_location VARCHAR(50) NULL AFTER email,
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE AFTER office_location,
        ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL AFTER password_hash,
        ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP NULL AFTER reset_token;
      `;

      await executeQuery(migrationSQL);

      // Create indexes if they don't exist
      try {
        await executeQuery('CREATE INDEX IF NOT EXISTS idx_is_admin ON users(is_admin)');
      } catch (error) {
        // Index might already exist, ignore
        if (!error.message.includes('Duplicate key name')) {
          logger.warn('Error creating is_admin index:', error.message);
        }
      }

      try {
        await executeQuery('CREATE INDEX IF NOT EXISTS idx_reset_token ON users(reset_token)');
      } catch (error) {
        // Index might already exist, ignore
        if (!error.message.includes('Duplicate key name')) {
          logger.warn('Error creating reset_token index:', error.message);
        }
      }

      logger.info('Migration completed successfully - first_name and related columns added');
    } else {
      logger.info('Database schema is up to date - first_name column exists');
    }
  } catch (error) {
    logger.error('Error running migrations:', error);
    throw error;
  }
}

module.exports = { runMigrations };
