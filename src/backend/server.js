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

const fs = require('fs');

app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // Inject API URL script
  const configScript = `<script>
    window.__API_URL__ = "${process.env.API_URL || ''}";
  </script>`;

  res.send(`${configScript}${html}`);
});

app.use('/', routes);

app.use(notFoundHandler);
app.use(errorHandler);



async function startServer() {
  try {
    logger.info('Initializing database connection pool...');
    createPool();
    logger.info('Database connection pool created');

    // Initialize users
    try {
      const UserService = require('./services/UserService');
      const userService = new UserService();
      
      // Initialize admin user from config.json
      // In development mode, this will use Password123 as the password
      try {
        const adminUser = await userService.initializeAdminFromConfig();
        logger.info(`Admin user initialized: ${adminUser.username} (ID: ${adminUser.id})`);
      } catch (error) {
        logger.warn('Could not initialize admin user from config.json:', error.message);
      }

      // Initialize development test user
      try {
        const testUser = await userService.initializeDevTestUser();
        if (testUser) {
          logger.info(`Development test user initialized: ${testUser.username} (ID: ${testUser.id})`);
        }
      } catch (error) {
        logger.warn('Could not initialize development test user:', error.message);
      }
    } catch (error) {
      logger.warn('User initialization failed:', error.message);
    }

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

