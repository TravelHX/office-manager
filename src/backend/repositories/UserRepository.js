const BaseRepository = require('../data-access/base-repository');
const User = require('../models/User');

class UserRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new User(result) : null;
  }

  async findByUsername(username) {
    const query = 'SELECT * FROM users WHERE username = ?';
    const results = await this.executeRawQuery(query, [username]);
    return results.length > 0 ? new User(results[0]) : null;
  }

  async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = ?';
    const results = await this.executeRawQuery(query, [email]);
    return results.length > 0 ? new User(results[0]) : null;
  }

  async findByResetToken(token) {
    const query = 'SELECT * FROM users WHERE reset_token = ?';
    const results = await this.executeRawQuery(query, [token]);
    return results.length > 0 ? new User(results[0]) : null;
  }

  async create(user) {
    const data = user instanceof User ? user.toDatabaseFormat() : user;
    const id = await super.create(data);
    return this.findById(id);
  }

  async createWithId(user) {
    // Create user with a specific ID (for admin initialization)
    const data = user instanceof User ? user.toDatabaseFormat() : user;
    const userObj = user instanceof User ? user : new User({ ...user, id: user.id });
    
    if (!userObj.id) {
      throw new Error('ID is required for createWithId');
    }

    // Check if user with this ID already exists
    const existingById = await this.findById(userObj.id);
    if (existingById) {
      throw new Error(`User with ID ${userObj.id} already exists`);
    }

    // Check if user with this username already exists
    if (userObj.username) {
      const existingByUsername = await this.findByUsername(userObj.username);
      if (existingByUsername) {
        throw new Error(`User with username ${userObj.username} already exists`);
      }
    }

    const columns = Object.keys(data).join(', ');
    const placeholders = Object.keys(data).map(() => '?').join(', ');
    const values = Object.values(data);
    
    // Include id in the insert
    const query = `INSERT INTO ${this.tableName} (id, ${columns}) VALUES (?, ${placeholders})`;
    await this.executeRawQuery(query, [userObj.id, ...values]);
    return this.findById(userObj.id);
  }

  async update(id, user) {
    const data = user instanceof User ? user.toDatabaseFormat() : user;
    await super.update(id, data);
    return this.findById(id);
  }

  async findAll() {
    const results = await super.findAll();
    return results.map(row => new User(row));
  }

  async updatePassword(id, passwordHash) {
    const query = 'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    await this.executeRawQuery(query, [passwordHash, id]);
    return this.findById(id);
  }

  async count() {
    const query = 'SELECT COUNT(*) as count FROM users';
    const results = await this.executeRawQuery(query);
    return results[0]?.count || 0;
  }

  async deleteById(id) {
    const query = 'DELETE FROM users WHERE id = ?';
    await this.executeRawQuery(query, [id]);
  }

  async deleteByUsername(username) {
    const query = 'DELETE FROM users WHERE username = ?';
    await this.executeRawQuery(query, [username]);
  }

  async deleteAll() {
    const query = 'DELETE FROM users';
    await this.executeRawQuery(query);
  }
}

module.exports = UserRepository;

