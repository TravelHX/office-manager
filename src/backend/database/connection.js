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

async function executeQuery(query, params = []) {
  const pool = getPool();
  try {
    const [results] = await pool.execute(query, params);
    return results;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

async function executeTransaction(queries) {
  const pool = getPool();
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const results = [];
    for (const { query, params } of queries) {
      const [result] = await connection.execute(query, params || []);
      results.push(result);
    }
    
    await connection.commit();
    return results;
  } catch (error) {
    await connection.rollback();
    console.error('Transaction error:', error);
    throw error;
  } finally {
    connection.release();
  }
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

