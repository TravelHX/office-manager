const express = require('express');
const config = require('./config/config');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');
const { createPool } = require('./database/connection');

const app = express();
const path = require('path');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/', routes);

app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    logger.info('Initializing database connection pool...');
    createPool();
    logger.info('Database connection pool created');

    // Run database migrations to ensure schema is up to date
    // This MUST succeed before continuing, as schema issues will cause runtime errors
    logger.info('Running database migrations...');
    try {
      const { runMigrations } = require('./database/migrations');
      await runMigrations();
      logger.info('Database migrations completed successfully');
    } catch (error) {
      logger.error('========================================');
      logger.error('CRITICAL: Database migration failed');
      logger.error('The server cannot start without a properly migrated database schema.');
      logger.error('Error:', error.message);
      logger.error('Full error:', error);
      logger.error('========================================');
      // Don't continue startup - schema issues will cause runtime errors
      throw new Error(`Database migration failed: ${error.message}`);
    }

    // Perform startup cleanup operations
    try {
      const UserService = require('./services/UserService');
      const userService = new UserService();
      
      // Run startup cleanup: remove admin/password123 user or flush all users if admin exists
      await userService.performStartupCleanup();
    } catch (error) {
      logger.warn('Startup cleanup failed:', error.message);
      // Continue startup even if cleanup fails
    }

    // Initialize version tracking on startup
    try {
      const VersionService = require('./services/VersionService');
      const versionService = new VersionService();
      const currentVersion = await versionService.initializeVersionOnStartup();
      logger.info(`Application version initialized: ${currentVersion.versionNumber}`);
    } catch (error) {
      logger.error('Version initialization failed:', error.message);
      // Continue startup even if version initialization fails
      // Error details are logged within VersionService
    }

    // Note: Admin user initialization from config.json is now optional
    // Only initialize if explicitly needed (can be removed in production)
    // The first user to register will automatically become admin

    app.listen(config.server.port, () => {
      logger.info(`Server running on port ${config.server.port}`);
      logger.info(`Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;

