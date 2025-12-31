class AdminConfiguration {
  constructor(data) {
    this.id = data.id;
    this.configKey = data.config_key;
    this.configValue = data.config_value;
    this.description = data.description;
    this.createdAt = data.created_at;
    this.updatedAt = data.updated_at;
  }

  toJSON() {
    return {
      id: this.id,
      configKey: this.configKey,
      configValue: this.configValue,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  toDatabaseFormat() {
    return {
      config_key: this.configKey,
      config_value: this.configValue,
      description: this.description,
    };
  }
}

module.exports = AdminConfiguration;

