/**
 * Phase 18 Version Tracking - End-to-end validation tests.
 *
 * Each block is labelled with the todo.md task it satisfies so the mapping
 * between spec validation and automated coverage is explicit.
 *
 * Tasks covered:
 *  - 18.27: end-to-end version tracking on deployment (config -> startup sync -> API)
 *  - 18.28: version increments correctly on each commit/deployment
 *  - 18.29: version is updated in the database on application startup
 *  - 18.30: server logs and frontend display errors when a version update fails
 *  - 18.31: covered in src/frontend/tests/version.test.js (client config storage)
 *  - 18.32: version follows semantic versioning format across API surface
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const VersionService = require('../../src/backend/services/VersionService');
const VersionRepository = require('../../src/backend/repositories/VersionRepository');
const UserService = require('../../src/backend/services/UserService');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

const CONFIG_PATH = path.resolve(__dirname, '../../data/config.json');
const SEMVER_REGEX = /^\d+\.\d+\.\d+\.\d+$/;

function readConfigVersion() {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);
  return config.deployment_info && config.deployment_info.version;
}

function writeConfigVersion(version) {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = JSON.parse(raw);
  config.deployment_info = Object.assign({}, config.deployment_info, { version });
  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

describe('Phase 18 Version Tracking - Validation', () => {
  let adminToken;
  let originalConfigVersion;

  async function ensureSeedAdminUser(userService) {
    try {
      return await userService.getUserByUsername('admin');
    } catch (error) {
      const User = require('../../src/backend/models/User');
      const UserRepository = require('../../src/backend/repositories/UserRepository');
      const { hashPassword } = require('../../src/backend/utils/password');
      const repo = new UserRepository();
      const hash = await hashPassword('Password123');
      const seed = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@test.com',
        password_hash: hash,
        is_admin: true,
        role: 'admin',
        profile_complete: true,
      });
      return await repo.createWithId(seed);
    }
  }

  beforeAll(async () => {
    originalConfigVersion = readConfigVersion();

    const userService = new UserService();
    const seedAdmin = await ensureSeedAdminUser(userService);

    try {
      await createProvisionedUserWithPassword(seedAdmin.id, {
        email: 'phase18admin@test.com',
        name: 'Phase 18 Admin',
        password: 'Test123!',
        is_admin: true,
        role: 'admin',
      });
    } catch (error) {
      // User may already exist from an earlier run
    }

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'phase18admin@test.com', password: 'Test123!' });
    adminToken = loginResponse.body.token;
  });

  afterAll(() => {
    if (originalConfigVersion) {
      writeConfigVersion(originalConfigVersion);
    }
  });

  beforeEach(async () => {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS app_version (
        id INT AUTO_INCREMENT PRIMARY KEY,
        version_number VARCHAR(20) NOT NULL UNIQUE,
        deployment_info TEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_version_number (version_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await executeQuery('DELETE FROM app_version');
    await executeQuery(
      'INSERT INTO app_version (version_number, deployment_info) VALUES ("0.1.0", "Phase 18 test baseline")'
    );
    writeConfigVersion('1.0.0.0');
  });

  afterEach(async () => {
    writeConfigVersion('1.0.0.0');
    await executeQuery('DELETE FROM app_version');
    await executeQuery(
      'INSERT INTO app_version (version_number, deployment_info) VALUES ("0.1.0", "Phase 18 test baseline")'
    );
  });

  // ----------------------------------------------------------------------
  // Task 18.27 - end-to-end deployment flow
  // ----------------------------------------------------------------------
  describe('18.27 end-to-end version tracking on deployment', () => {
    test('config change flows through startup sync to database and GET /api/version', async () => {
      writeConfigVersion('2.5.7.0');

      const versionService = new VersionService();
      const synced = await versionService.initializeVersionOnStartup();

      expect(synced.versionNumber).toBe('2.5.7.0');

      const repo = new VersionRepository();
      const dbRow = await repo.getCurrent();
      expect(dbRow).not.toBeNull();
      expect(dbRow.versionNumber).toBe('2.5.7.0');

      const response = await request(app).get('/api/version').expect(200);
      expect(response.body.versionNumber).toBe('2.5.7.0');
      expect(response.body.versionNumber).toMatch(SEMVER_REGEX);
    });

    test('admin POST /api/version updates config, database, and subsequent GET', async () => {
      const updateResponse = await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ versionNumber: '3.4.5', deploymentInfo: 'Phase 18 deployment' })
        .expect(200);

      expect(updateResponse.body.versionNumber).toBe('3.4.5.0');
      expect(readConfigVersion()).toBe('3.4.5.0');

      const repo = new VersionRepository();
      const dbRow = await repo.getCurrent();
      expect(dbRow.versionNumber).toBe('3.4.5.0');

      const getResponse = await request(app).get('/api/version').expect(200);
      expect(getResponse.body.versionNumber).toBe('3.4.5.0');
      expect(getResponse.body.deploymentInfo).toBe('Phase 18 deployment');
    });
  });

  // ----------------------------------------------------------------------
  // Task 18.28 - increments on each commit/deployment
  // ----------------------------------------------------------------------
  describe('18.28 version increments correctly on each commit/deployment', () => {
    test('patch increment bumps the trailing segment and keeps semver format', async () => {
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ versionNumber: '4.0.0' })
        .expect(200);

      const first = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);
      expect(first.body.versionNumber).toBe('4.0.1.0');
      expect(first.body.versionNumber).toMatch(SEMVER_REGEX);

      const second = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ incrementType: 'patch' })
        .expect(200);
      expect(second.body.versionNumber).toBe('4.0.2.0');

      expect(readConfigVersion()).toBe('4.0.2.0');
    });

    test('minor and major increments reset lower segments', async () => {
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ versionNumber: '4.5.9' })
        .expect(200);

      const minor = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ incrementType: 'minor' })
        .expect(200);
      expect(minor.body.versionNumber).toBe('4.6.0.0');

      const major = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ incrementType: 'major' })
        .expect(200);
      expect(major.body.versionNumber).toBe('5.0.0.0');
    });
  });

  // ----------------------------------------------------------------------
  // Task 18.29 - version is updated in the database on application startup
  // ----------------------------------------------------------------------
  describe('18.29 version is updated in database on application startup', () => {
    test('startup sync writes config version to database when mismatched', async () => {
      const repo = new VersionRepository();
      await repo.updateCurrentVersion('7.7.7.0', 'seed for mismatch');
      writeConfigVersion('8.8.8.0');

      const versionService = new VersionService();
      const synced = await versionService.initializeVersionOnStartup();

      expect(synced.versionNumber).toBe('8.8.8.0');
      const dbRow = await repo.getCurrent();
      expect(dbRow.versionNumber).toBe('8.8.8.0');
      expect(dbRow.deploymentInfo).toMatch(/Updated on startup:/);
    });

    test('startup sync leaves database untouched when versions already match', async () => {
      const repo = new VersionRepository();
      writeConfigVersion('9.1.0.0');
      await repo.updateCurrentVersion('9.1.0.0', 'already aligned');

      const before = await repo.getCurrent();
      const beforeTimestamp = before.updatedAt;

      const versionService = new VersionService();
      const synced = await versionService.initializeVersionOnStartup();
      expect(synced.versionNumber).toBe('9.1.0.0');

      const after = await repo.getCurrent();
      expect(after.versionNumber).toBe('9.1.0.0');
      expect(after.deploymentInfo).toBe('already aligned');
      expect(String(after.updatedAt)).toBe(String(beforeTimestamp));
    });
  });

  // ----------------------------------------------------------------------
  // Task 18.30 - server-side error display when a version update fails
  // ----------------------------------------------------------------------
  describe('18.30 error is displayed when version update fails', () => {
    test('invalid version payload returns 400 with a descriptive error body', async () => {
      const response = await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ versionNumber: 'not-a-version' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      const message = response.body.error.message || response.body.error;
      expect(String(message).toLowerCase()).toContain('invalid version format');
    });

    test('invalid increment type returns 400 with a descriptive error body', async () => {
      const response = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ incrementType: 'nonsense' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      const message = response.body.error.message || response.body.error;
      expect(String(message).toLowerCase()).toContain('invalid increment type');
    });

    test('startup initialization returns a safe default and continues when the repository throws', async () => {
      const versionService = new VersionService();
      const originalGetCurrent = versionService.versionRepository.getCurrent;
      versionService.versionRepository.getCurrent = jest.fn(() => {
        throw new Error('Simulated repository failure');
      });

      try {
        const result = await versionService.initializeVersionOnStartup();
        expect(result.versionNumber).toBe('1.0.0.0');
        expect(String(result.deploymentInfo || '').toLowerCase()).toContain('fail');
      } finally {
        versionService.versionRepository.getCurrent = originalGetCurrent;
      }
    });
  });

  // ----------------------------------------------------------------------
  // Task 18.32 - semantic versioning format
  // ----------------------------------------------------------------------
  describe('18.32 version follows semantic versioning format', () => {
    test('GET /api/version always returns MAJOR.MINOR.PATCH.REVISION shape', async () => {
      const response = await request(app).get('/api/version').expect(200);
      expect(response.body.versionNumber).toMatch(SEMVER_REGEX);
    });

    test('POST /api/version normalizes a three-segment version to four segments', async () => {
      const response = await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ versionNumber: '6.7.8' })
        .expect(200);

      expect(response.body.versionNumber).toBe('6.7.8.0');
      expect(response.body.versionNumber).toMatch(SEMVER_REGEX);
      expect(readConfigVersion()).toMatch(SEMVER_REGEX);
    });

    test.each([
      ['empty string', ''],
      ['missing minor', '1'],
      ['too many segments', '1.2.3.4.5'],
      ['non-numeric', '1.2.three'],
      ['negative', '1.-1.0'],
      ['leading dot', '.1.2.3'],
    ])('POST /api/version rejects %s', async (_label, value) => {
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ versionNumber: value })
        .expect(400);
    });
  });
});
