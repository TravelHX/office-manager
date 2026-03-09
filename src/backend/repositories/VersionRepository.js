const BaseRepository = require('../data-access/base-repository');
const Version = require('../models/Version');

class VersionRepository extends BaseRepository {
  constructor() {
    super('app_version');
  }

  async findById(id) {
    const result = await super.findById(id);
    return result ? new Version(result) : null;
  }

  async findByVersionNumber(versionNumber) {
    const query = 'SELECT * FROM app_version WHERE version_number = ?';
    const results = await this.executeRawQuery(query, [versionNumber]);
    return results.length > 0 ? new Version(results[0]) : null;
  }

  async getCurrent() {
    const query = 'SELECT * FROM app_version ORDER BY updated_at DESC LIMIT 1';
    const results = await this.executeRawQuery(query);
    return results.length > 0 ? new Version(results[0]) : null;
  }

  async create(version) {
    const data = version instanceof Version ? version.toDatabaseFormat() : version;
    const id = await super.create(data);
    return this.findById(id);
  }

  async update(id, version) {
    const data = version instanceof Version ? version.toDatabaseFormat() : version;
    await super.update(id, data);
    return this.findById(id);
  }

  async updateCurrentVersion(versionNumber, deploymentInfo = null) {
    // Get current version
    const current = await this.getCurrent();
    
    if (current) {
      // Update existing version
      return await this.update(current.id, {
        version_number: versionNumber,
        deployment_info: deploymentInfo,
      });
    } else {
      // Create new version record
      const version = new Version({
        version_number: versionNumber,
        deployment_info: deploymentInfo,
      });
      return await this.create(version);
    }
  }

  async findAll() {
    const results = await super.findAll();
    return results.map(row => new Version(row));
  }
}

module.exports = VersionRepository;
