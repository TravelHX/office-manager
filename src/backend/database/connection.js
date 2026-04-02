const mysql = require('mysql2/promise');
const config = require('../config/config');

let pool = null;

function createPool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: config.database.host,
    port: config.database.port,
    database: config.database.database,
    user: config.database.user,
    password: config.database.password,
    connectionLimit: config.database.connectionLimit,
    waitForConnections: config.database.waitForConnections,
    queueLimit: config.database.queueLimit,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });

  return pool;
}

function getPool() {
  if (!pool) {
    return createPool();
  }
  return pool;
}

async function executeQuery(query, params = [], retries = 3, delay = 1000) {
  const pool = getPool();
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [results] = await pool.execute(query, params);
      return results;
    } catch (error) {
      lastError = error;
      // Retry on DNS resolution errors (EAI_AGAIN) or connection errors
      if ((error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') && attempt < retries) {
        console.error(`Database query error (attempt ${attempt + 1}/${retries + 1}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        continue;
      }
      console.error('Database query error:', error);
      throw error;
    }
  }
  
  throw lastError;
}

async function executeTransaction(queries, retries = 3, delay = 1000) {
  const pool = getPool();
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    let connection;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      
      const results = [];
      for (const { query, params } of queries) {
        const [result] = await connection.execute(query, params || []);
        results.push(result);
      }
      
      await connection.commit();
      connection.release();
      return results;
    } catch (error) {
      if (connection) {
        try {
          await connection.rollback();
        } catch (rollbackError) {
          // Ignore rollback errors
        }
        connection.release();
      }
      lastError = error;
      // Retry on DNS resolution errors (EAI_AGAIN) or connection errors
      if ((error.code === 'EAI_AGAIN' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') && attempt < retries) {
        console.error(`Transaction error (attempt ${attempt + 1}/${retries + 1}):`, error.message);
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
        continue;
      }
      console.error('Transaction error:', error);
      throw error;
    }
  }
  
  throw lastError;
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  createPool,
  getPool,
  executeQuery,
  executeTransaction,
  closePool,
};

