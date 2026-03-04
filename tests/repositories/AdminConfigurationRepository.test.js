const AdminConfigurationRepository = require('../../src/backend/repositories/AdminConfigurationRepository');
const AdminConfiguration = require('../../src/backend/models/AdminConfiguration');
const { executeQuery } = require('../../src/backend/database/connection');

describe('AdminConfigurationRepository', () => {
  let repository;

  beforeAll(async () => {
    repository = new AdminConfigurationRepository();
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM admin_config');
  });

  describe('findByKey', () => {
    test('should return AdminConfiguration when found', async () => {
      await executeQuery(`
        INSERT INTO admin_config (config_key, config_value) 
        VALUES ('desk_count', '10')
      `);

      const config = await repository.findByKey('desk_count');

      expect(config).toBeInstanceOf(AdminConfiguration);
      expect(config.configKey).toBe('desk_count');
      expect(config.configValue).toBe('10');
    });

    test('should return null when not found', async () => {
      const config = await repository.findByKey('nonexistent');
      expect(config).toBeNull();
    });
  });

  describe('updateByKey', () => {
    test('should update configuration value', async () => {
      await executeQuery(`
        INSERT INTO admin_config (config_key, config_value) 
        VALUES ('desk_count', '10')
      `);

      const updated = await repository.updateByKey('desk_count', '20');

      expect(updated.configValue).toBe('20');
    });
  });

  describe('getDeskCount', () => {
    test('should return desk count as integer', async () => {
      await executeQuery(`
        INSERT INTO admin_config (config_key, config_value) 
        VALUES ('desk_count', '15')
      `);

      const count = await repository.getDeskCount();

      expect(count).toBe(15);
      expect(typeof count).toBe('number');
    });

    test('should return 0 when not found', async () => {
      const count = await repository.getDeskCount();
      expect(count).toBe(0);
    });
  });

  describe('setDeskCount', () => {
    test('should set desk count', async () => {
      await executeQuery(`
        INSERT INTO admin_config (config_key, config_value) 
        VALUES ('desk_count', '10')
      `);

      const updated = await repository.setDeskCount(25);

      expect(updated.configValue).toBe('25');
    });
  });

  describe('getParkingCount', () => {
    test('should return parking count as integer', async () => {
      await executeQuery(`
        INSERT INTO admin_config (config_key, config_value) 
        VALUES ('parking_count', '12')
      `);

      const count = await repository.getParkingCount();

      expect(count).toBe(12);
    });
  });

  describe('setParkingCount', () => {
    test('should set parking count', async () => {
      await executeQuery(`
        INSERT INTO admin_config (config_key, config_value) 
        VALUES ('parking_count', '10')
      `);

      const updated = await repository.setParkingCount(20);

      expect(updated.configValue).toBe('20');
    });
  });
});
