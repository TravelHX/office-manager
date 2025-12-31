const config = require('../config/config');

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const currentLevel = logLevels[config.logging.level] || logLevels.info;

function log(level, message, ...args) {
  if (logLevels[level] <= currentLevel) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (level === 'error') {
      console.error(logMessage, ...args);
    } else {
      console.log(logMessage, ...args);
    }
  }
}

const logger = {
  error: (message, ...args) => log('error', message, ...args),
  warn: (message, ...args) => log('warn', message, ...args),
  info: (message, ...args) => log('info', message, ...args),
  debug: (message, ...args) => log('debug', message, ...args),
};

module.exports = logger;

