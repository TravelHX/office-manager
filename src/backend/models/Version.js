class Version {
  constructor(data) {
    this.id = data.id;
    this.versionNumber = data.version_number || data.versionNumber;
    this.deploymentInfo = data.deployment_info || data.deploymentInfo || null;
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  toJSON() {
    return {
      id: this.id,
      versionNumber: this.versionNumber,
      deploymentInfo: this.deploymentInfo,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      version_number: this.versionNumber,
      deployment_info: this.deploymentInfo,
    };
  }
}

module.exports = Version;
