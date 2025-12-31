const BaseRepository = require('../data-access/base-repository');
const AdminConfiguration = require('../models/AdminConfiguration');

class AdminConfigurationRepository extends BaseRepository {
  constructor() {
    super('admin_config');
  }

  async findByKey(configKey) {
    const query = 'SELECT * FROM admin_config WHERE config_key = ?';
    const results = await this.executeRawQuery(query, [configKey]);
    return results.length > 0 ? new AdminConfiguration(results[0]) : null;
  }

  async updateByKey(configKey, configValue) {
    const query = `
      UPDATE admin_config 
      SET config_value = ?, updated_at = NOW() 
      WHERE config_key = ?
    `;
    await this.executeRawQuery(query, [configValue, configKey]);
    return this.findByKey(configKey);
  }

  async getDeskCount() {
    const config = await this.findByKey('desk_count');
    return config ? parseInt(config.configValue, 10) : 0;
  }

  async getParkingCount() {
    const config = await this.findByKey('parking_count');
    return config ? parseInt(config.configValue, 10) : 0;
  }

  async setDeskCount(count) {
    return await this.updateByKey('desk_count', count.toString());
  }

  async setParkingCount(count) {
    return await this.updateByKey('parking_count', count.toString());
  }

  async findAll() {
    const results = await super.findAll();
    return results.map(row => new AdminConfiguration(row));
  }
}

module.exports = AdminConfigurationRepository;

