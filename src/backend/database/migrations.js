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

// Cache the in-flight migration so concurrent callers (e.g. server startup and
// test setup) share one execution instead of racing to ADD COLUMN.
let currentMigration = null;

/**
 * Run database migrations to ensure schema is up to date
 * This ensures that columns added in later schema versions are present
 */
async function runMigrations() {
  if (currentMigration) {
    return currentMigration;
  }
  currentMigration = _runMigrationsImpl().catch((err) => {
    currentMigration = null;
    throw err;
  });
  return currentMigration;
}

async function _runMigrationsImpl() {
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

    // Check each column individually and add if missing.
    // Do NOT use "ADD COLUMN IF NOT EXISTS": unsupported on MySQL 5.7 and many Azure Database for MySQL
    // configurations (ER_PARSE_ERROR). We already verify absence via information_schema before each ADD.
    const columnsToAdd = [
      { name: 'first_name', sql: 'ADD COLUMN first_name VARCHAR(100) NULL AFTER username' },
      { name: 'last_name', sql: 'ADD COLUMN last_name VARCHAR(100) NULL AFTER first_name' },
      { name: 'office_location', sql: 'ADD COLUMN office_location VARCHAR(50) NULL AFTER email' },
      { name: 'is_admin', sql: 'ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE AFTER office_location' },
      { name: 'reset_token', sql: 'ADD COLUMN reset_token VARCHAR(255) NULL AFTER password_hash' },
      { name: 'reset_token_expiry', sql: 'ADD COLUMN reset_token_expiry TIMESTAMP NULL AFTER reset_token' }
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

      // Create indexes if missing (no CREATE INDEX IF NOT EXISTS on MySQL 5.7 / older Azure MySQL)
      logger.info('Creating indexes...');
      try {
        await executeQuery('CREATE INDEX idx_is_admin ON users(is_admin)');
        logger.info('✓ Index idx_is_admin created');
      } catch (error) {
        if (error.errno === 1061 || error.message.includes('Duplicate key name')) {
          logger.info('✓ Index idx_is_admin already exists');
        } else {
          logger.warn(`Warning creating idx_is_admin index: ${error.message}`);
        }
      }

      try {
        await executeQuery('CREATE INDEX idx_reset_token ON users(reset_token)');
        logger.info('✓ Index idx_reset_token created');
      } catch (error) {
        if (error.errno === 1061 || error.message.includes('Duplicate key name')) {
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

    // Ensure version tracking table exists
    try {
      await executeQuery('SELECT 1 FROM app_version LIMIT 1');
      logger.info('Version tracking table exists');
    } catch (error) {
      logger.info('Creating version tracking table...');
      const versionTableSQL = `
        CREATE TABLE IF NOT EXISTS app_version (
          id INT AUTO_INCREMENT PRIMARY KEY,
          version_number VARCHAR(20) NOT NULL UNIQUE,
          deployment_info TEXT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_version_number (version_number)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      await executeQuery(versionTableSQL);
      
      // Insert initial version if table was just created
      const initialVersionSQL = `
        INSERT INTO app_version (version_number, deployment_info) 
        VALUES ('0.1.0', 'Initial version')
        ON DUPLICATE KEY UPDATE version_number = version_number
      `;
      await executeQuery(initialVersionSQL);
      logger.info('Version tracking table created');
    }

    // Phase 19: profile completion and admin provisioning (invitation token)
    const usersProvisionColumns = [
      { name: 'profile_complete', sql: 'ADD COLUMN profile_complete BOOLEAN NOT NULL DEFAULT TRUE' },
      { name: 'invitation_token', sql: 'ADD COLUMN invitation_token VARCHAR(255) NULL' },
      { name: 'invitation_token_expiry', sql: 'ADD COLUMN invitation_token_expiry TIMESTAMP NULL' },
    ];

    for (const col of usersProvisionColumns) {
      const exists = await columnExists(col.name);
      if (!exists) {
        logger.info(`Adding users column: ${col.name}...`);
        await executeQuery(`ALTER TABLE users ${col.sql}`);
        logger.info(`Column ${col.name} added`);
      }
    }

    try {
      await executeQuery(`
        ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL
      `);
      logger.info('password_hash column allows NULL (provisioned users)');
    } catch (alterErr) {
      logger.warn(`password_hash NULL migration note: ${alterErr.message}`);
    }

    try {
      await executeQuery('CREATE INDEX idx_invitation_token ON users(invitation_token)');
      logger.info('Index idx_invitation_token created or attempted');
    } catch (idxErr) {
      if (!idxErr.message.includes('Duplicate')) {
        logger.warn(`idx_invitation_token: ${idxErr.message}`);
      }
    }

    // Phase 23a: drop the overtime_records table if it exists.
    // The feature has been removed end-to-end; operators should take their own
    // backup of this table (see docs/technical-notes-phase23-overtime-removal.md)
    // before upgrading past this release if historical rows need preserving.
    try {
      await executeQuery('DROP TABLE IF EXISTS overtime_records');
      logger.info('overtime_records table dropped or already absent');
    } catch (error) {
      logger.warn(`Failed to drop overtime_records table: ${error.message}`);
    }

    // Phase 21a: audit_events table. Ensures the append-only audit log
    // exists in every environment, independent of whether the Docker init
    // script src/sql/08-audit-events-schema.sql ran (it only runs on first
    // MySQL container init; does not apply to already-initialised DBs).
    try {
      await executeQuery('SELECT 1 FROM audit_events LIMIT 1');
      logger.info('audit_events table exists');
    } catch (error) {
      logger.info('Creating audit_events table...');
      const auditTableSQL = `
        CREATE TABLE IF NOT EXISTS audit_events (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          actor_id INT NULL,
          actor_email VARCHAR(255) NULL,
          action_type VARCHAR(64) NOT NULL,
          target_type VARCHAR(64) NULL,
          target_id INT NULL,
          summary VARCHAR(512) NULL,
          payload JSON NULL,
          ip_address VARCHAR(45) NULL,
          INDEX idx_occurred_at (occurred_at),
          INDEX idx_actor_id (actor_id),
          INDEX idx_action_type (action_type),
          INDEX idx_actor_occurred (actor_id, occurred_at),
          INDEX idx_target (target_type, target_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `;
      await executeQuery(auditTableSQL);
      logger.info('audit_events table created');
    }

    // Phase 23d: floor plan map tables. See src/sql/09-floor-plan-maps-schema.sql
    // for the canonical definitions; mirrored here so existing databases (which
    // skip the docker-entrypoint-initdb step) get the tables on next boot.
    const mapTableStatements = [
      {
        name: 'floor_plans',
        sql: `
          CREATE TABLE IF NOT EXISTS floor_plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            context VARCHAR(32) NOT NULL UNIQUE,
            image_path VARCHAR(512) NOT NULL,
            image_mime VARCHAR(64) NOT NULL,
            image_version INT NOT NULL DEFAULT 1,
            uploaded_by INT NULL,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_floor_plans_context (context)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `,
      },
      {
        name: 'map_landmarks',
        sql: `
          CREATE TABLE IF NOT EXISTS map_landmarks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            context VARCHAR(32) NOT NULL,
            type VARCHAR(32) NOT NULL,
            label VARCHAR(128) NULL,
            x_norm DECIMAL(8,6) NOT NULL,
            y_norm DECIMAL(8,6) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_landmarks_context (context)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `,
      },
      {
        name: 'desk_map_coordinates',
        sql: `
          CREATE TABLE IF NOT EXISTS desk_map_coordinates (
            desk_id INT PRIMARY KEY,
            x_norm DECIMAL(8,6) NOT NULL,
            y_norm DECIMAL(8,6) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_desk_map_coordinates_desk
              FOREIGN KEY (desk_id) REFERENCES desks(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `,
      },
      {
        name: 'parking_space_map_coordinates',
        sql: `
          CREATE TABLE IF NOT EXISTS parking_space_map_coordinates (
            parking_space_id INT PRIMARY KEY,
            x_norm DECIMAL(8,6) NOT NULL,
            y_norm DECIMAL(8,6) NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_parking_space_map_coordinates_space
              FOREIGN KEY (parking_space_id) REFERENCES parking_spaces(id) ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `,
      },
    ];
    for (const stmt of mapTableStatements) {
      try {
        await executeQuery(`SELECT 1 FROM ${stmt.name} LIMIT 1`);
        logger.info(`${stmt.name} table exists`);
      } catch (_) {
        logger.info(`Creating ${stmt.name} table...`);
        await executeQuery(stmt.sql);
        logger.info(`${stmt.name} table created`);
      }
    }

    // Phase 26: third role 'office_admin'. The users table already has both
    // `is_admin BOOLEAN` and `role VARCHAR(50)`. Going forward, `role` is the
    // single source of truth with three valid values: 'user', 'office_admin',
    // 'admin'. `is_admin` is kept in sync as a derived column for any legacy
    // SQL or test fixtures that still query it directly. This step backfills
    // any rows where the two columns disagree:
    //   - is_admin = 1 but role != 'admin' -> role = 'admin'
    //   - is_admin = 0 but role = 'admin'  -> is_admin = 1 (the role wins)
    // The fix-up is idempotent and safe to run on every boot.
    try {
      const r1 = await executeQuery(
        "UPDATE users SET role = 'admin' WHERE is_admin = 1 AND role <> 'admin'"
      );
      const r2 = await executeQuery(
        "UPDATE users SET is_admin = 1 WHERE role = 'admin' AND (is_admin IS NULL OR is_admin = 0)"
      );
      const a = (r1 && r1.affectedRows) || 0;
      const b = (r2 && r2.affectedRows) || 0;
      if (a > 0 || b > 0) {
        logger.info(`Phase 26 role backfill: aligned ${a + b} user row(s) between is_admin and role`);
      } else {
        logger.info('Phase 26 role backfill: no rows needed alignment');
      }
    } catch (error) {
      logger.warn(`Phase 26 role backfill skipped: ${error.message}`);
    }

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
