const { executeQuery, executeTransaction } = require('../database/connection');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async findAll() {
    const query = `SELECT * FROM ${this.tableName}`;
    return await executeQuery(query);
  }

  async findById(id) {
    const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const results = await executeQuery(query, [id]);
    return results.length > 0 ? results[0] : null;
  }

  async create(data) {
    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    const query = `INSERT INTO ${this.tableName} (${columns}) VALUES (${placeholders})`;
    const result = await executeQuery(query, values);
    return result.insertId;
  }

  async update(id, data) {
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(data), id];
    
    const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
    await executeQuery(query, values);
    return id;
  }

  async delete(id) {
    const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await executeQuery(query, [id]);
    return true;
  }

  async executeRawQuery(query, params = []) {
    return await executeQuery(query, params);
  }

  async executeTransaction(queries) {
    return await executeTransaction(queries);
  }
}

module.exports = BaseRepository;

