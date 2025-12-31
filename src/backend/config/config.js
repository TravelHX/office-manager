require('dotenv').config();

const config = {
  env: process.env.NODE_ENV || 'development',
  server: {
    port: parseInt(process.env.SERVER_PORT || '3000', 10),
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'office_manager',
    user: process.env.DB_USER || 'office_user',
    password: process.env.DB_PASSWORD || 'office_password',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    waitForConnections: true,
    queueLimit: 0,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

module.exports = config;

