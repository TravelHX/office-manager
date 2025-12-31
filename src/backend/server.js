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

