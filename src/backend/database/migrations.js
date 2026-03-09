const { executeQuery, getPool } = require('./connection');
const logger = require('../utils/logger');

/**
 * Wait for database connection to be ready
 */
async function waitForDatabase(maxRetries = 10, delayMs = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const pool = getPool();
      await pool.query('SELECT 1');
      logger.info('Database connection verified');
      return true;
    } catch (error) {
      if (i < maxRetries - 1) {
        logger.info(`Waiting for database connection... (attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw new Error(`Database connection failed after ${maxRetries} attempts: ${error.message}`);
      }
    }
  }
}

/**
 * Check if a column exists in the users table
 */
async function columnExists(columnName) {
  try {
    const checkColumnQuery = `
      SELECT COUNT(*) as count
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = ?
    `;
    const result = await executeQuery(checkColumnQuery, [columnName]);
    return result[0]?.count > 0;
  } catch (error) {
    logger.error(`Error checking for column ${columnName}:`, error.message);
    throw error;
  }
}

/**
 * Run database migrations to ensure schema is up to date
 * This ensures that columns added in later schema versions are present
 */
async function runMigrations() {
  logger.info('========================================');
  logger.info('Starting database schema migration check');
  logger.info('========================================');

  try {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Check if users table exists
    try {
      await executeQuery('SELECT 1 FROM users LIMIT 1');
      logger.info('Users table exists');
    } catch (error) {
      logger.error('Users table does not exist - database may not be initialized');
      throw new Error('Users table not found. Please ensure database schema is initialized.');
    }

    // Check each column individually and add if missing
    const columnsToAdd = [
      { name: 'first_name', sql: 'ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL AFTER username' },
      { name: 'last_name', sql: 'ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL AFTER first_name' },
      { name: 'office_location', sql: 'ADD COLUMN IF NOT EXISTS office_location VARCHAR(50) NULL AFTER email' },
      { name: 'is_admin', sql: 'ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE AFTER office_location' },
      { name: 'reset_token', sql: 'ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255) NULL AFTER password_hash' },
      { name: 'reset_token_expiry', sql: 'ADD COLUMN IF NOT EXISTS reset_token_expiry TIMESTAMP NULL AFTER reset_token' }
    ];

    let migrationNeeded = false;
    const missingColumns = [];

    // Check which columns are missing
    for (const column of columnsToAdd) {
      const exists = await columnExists(column.name);
      if (!exists) {
        migrationNeeded = true;
        missingColumns.push(column.name);
        logger.warn(`Column '${column.name}' is MISSING from users table`);
      } else {
        logger.info(`Column '${column.name}' exists`);
      }
    }

    if (migrationNeeded) {
      logger.info('========================================');
      logger.info(`Migration required - ${missingColumns.length} column(s) missing: ${missingColumns.join(', ')}`);
      logger.info('Running migration to add missing columns...');
      logger.info('========================================');

      // Run migration SQL - add columns one at a time to avoid issues
      // MySQL doesn't support multiple ADD COLUMN IF NOT EXISTS in a single ALTER TABLE statement
      for (const column of columnsToAdd) {
        if (missingColumns.includes(column.name)) {
          try {
            logger.info(`Adding column: ${column.name}...`);
            // Use individual ALTER TABLE statements
            await executeQuery(`ALTER TABLE users ${column.sql}`);
            
            // Verify the column was added
            const exists = await columnExists(column.name);
            if (exists) {
              logger.info(`✓ Successfully added column: ${column.name}`);
            } else {
              throw new Error(`Column ${column.name} was not added successfully`);
            }
          } catch (error) {
            // Check if column was added by another process or if error is acceptable
            const exists = await columnExists(column.name);
            if (exists) {
              logger.info(`✓ Column ${column.name} already exists (may have been added concurrently)`);
            } else {
              // Check if error is about column already existing (some MySQL versions)
              if (error.message.includes('Duplicate column name') || error.message.includes('already exists')) {
                logger.info(`✓ Column ${column.name} already exists`);
              } else {
                logger.error(`✗ Failed to add column ${column.name}:`, error.message);
                logger.error(`✗ Error code: ${error.code}, SQL State: ${error.sqlState}`);
                throw error;
              }
            }
          }
        }
      }

      // Create indexes if they don't exist
      logger.info('Creating indexes...');
      try {
        await executeQuery('CREATE INDEX IF NOT EXISTS idx_is_admin ON users(is_admin)');
        logger.info('✓ Index idx_is_admin created or already exists');
      } catch (error) {
        if (error.message.includes('Duplicate key name')) {
          logger.info('✓ Index idx_is_admin already exists');
        } else {
          logger.warn(`Warning creating idx_is_admin index: ${error.message}`);
        }
      }

      try {
        await executeQuery('CREATE INDEX IF NOT EXISTS idx_reset_token ON users(reset_token)');
        logger.info('✓ Index idx_reset_token created or already exists');
      } catch (error) {
        if (error.message.includes('Duplicate key name')) {
          logger.info('✓ Index idx_reset_token already exists');
        } else {
          logger.warn(`Warning creating idx_reset_token index: ${error.message}`);
        }
      }

      logger.info('========================================');
      logger.info('Migration completed successfully');
      logger.info('========================================');
    } else {
      logger.info('========================================');
      logger.info('Database schema is up to date - all required columns exist');
      logger.info('========================================');
    }

    // Verify migration by checking first_name column again
    const firstNameExists = await columnExists('first_name');
    if (!firstNameExists) {
      throw new Error('Migration verification failed: first_name column still missing after migration');
    }
    logger.info('Migration verification passed: first_name column confirmed present');

  } catch (error) {
    logger.error('========================================');
    logger.error('MIGRATION FAILED');
    logger.error('========================================');
    logger.error('Error details:', error.message);
    logger.error('Stack trace:', error.stack);
    logger.error('========================================');
    throw error;
  }
}

module.exports = { runMigrations };
