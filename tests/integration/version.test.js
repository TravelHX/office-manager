const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const UserService = require('../../src/backend/services/UserService');

describe('Version API Integration Tests', () => {
  let authToken;
  let adminToken;

  beforeAll(async () => {
    // Create test admin user
    const userService = new UserService();
    try {
      await userService.createUser({
        username: 'versiontestadmin',
        email: 'versiontestadmin@test.com',
        password: 'Test123!',
        isAdmin: true,
      });
    } catch (error) {
      // User might already exist
    }

    // Login as admin
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'versiontestadmin',
        password: 'Test123!',
      });

    adminToken = loginResponse.body.token;
  });

  beforeEach(async () => {
    // Ensure version table exists and has initial version
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

    await executeQuery(`
      INSERT INTO app_version (version_number, deployment_info) 
      VALUES ('0.1.0', 'Test initial version')
      ON DUPLICATE KEY UPDATE version_number = version_number
    `);
  });

  afterEach(async () => {
    // Clean up version table
    await executeQuery('DELETE FROM app_version WHERE version_number != "0.1.0"');
  });

  describe('GET /api/version', () => {
    test('should return current version (public endpoint)', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      expect(response.body).toHaveProperty('versionNumber');
      expect(response.body).toHaveProperty('deploymentInfo');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('updatedAt');
      expect(typeof response.body.versionNumber).toBe('string');
    });

    test('should return version in correct format', async () => {
      const response = await request(app)
        .get('/api/version')
        .expect(200);

      const versionRegex = /^\d+\.\d+\.\d+$/;
      expect(response.body.versionNumber).toMatch(versionRegex);
    });
  });

  describe('POST /api/version', () => {
    test('should update version (admin only)', async () => {
      const response = await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          versionNumber: '1.0.0',
          deploymentInfo: 'Test deployment',
        })
        .expect(200);

      expect(response.body.versionNumber).toBe('1.0.0');
      expect(response.body.deploymentInfo).toBe('Test deployment');

      // Verify version was updated in database
      const getResponse = await request(app)
        .get('/api/version')
        .expect(200);

      expect(getResponse.body.versionNumber).toBe('1.0.0');
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/version')
        .send({
          versionNumber: '1.0.0',
        })
        .expect(401);
    });

    test('should require admin role', async () => {
      // Create regular user
      const userService = new UserService();
      let regularToken;
      try {
        await userService.createUser({
          username: 'versiontestuser',
          email: 'versiontestuser@test.com',
          password: 'Test123!',
          isAdmin: false,
        });

        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'versiontestuser',
            password: 'Test123!',
          });

        regularToken = loginResponse.body.token;
      } catch (error) {
        // User might already exist
        const loginResponse = await request(app)
          .post('/api/auth/login')
          .send({
            username: 'versiontestuser',
            password: 'Test123!',
          });
        regularToken = loginResponse.body.token;
      }

      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          versionNumber: '1.0.0',
        })
        .expect(403);
    });

    test('should return 400 for missing version number', async () => {
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          deploymentInfo: 'Test deployment',
        })
        .expect(400);
    });

    test('should return 400 for invalid version format', async () => {
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          versionNumber: 'invalid',
        })
        .expect(400);
    });
  });

  describe('POST /api/version/increment', () => {
    test('should increment patch version by default', async () => {
      // Set initial version
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          versionNumber: '1.2.3',
        })
        .expect(200);

      const response = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(response.body.versionNumber).toBe('1.2.4');
    });

    test('should increment minor version', async () => {
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          versionNumber: '1.2.3',
        })
        .expect(200);

      const response = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          incrementType: 'minor',
        })
        .expect(200);

      expect(response.body.versionNumber).toBe('1.3.0');
    });

    test('should increment major version', async () => {
      await request(app)
        .post('/api/version')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          versionNumber: '1.2.3',
        })
        .expect(200);

      const response = await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          incrementType: 'major',
        })
        .expect(200);

      expect(response.body.versionNumber).toBe('2.0.0');
    });

    test('should return 400 for invalid increment type', async () => {
      await request(app)
        .post('/api/version/increment')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          incrementType: 'invalid',
        })
        .expect(400);
    });

    test('should require authentication', async () => {
      await request(app)
        .post('/api/version/increment')
        .send({
          incrementType: 'patch',
        })
        .expect(401);
    });
  });
});
