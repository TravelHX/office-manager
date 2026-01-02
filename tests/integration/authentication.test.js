const request = require('supertest');
const app = require('../../src/backend/server');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');

describe('Authentication Endpoints', () => {
  let userService;
  let adminUser;
  let regularUser;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    userService = new UserService();

    // Create test admin user
    try {
      adminUser = await userService.getUserByUsername('admin');
    } catch (error) {
      // Create admin user if it doesn't exist
      const passwordHash = require('../../src/backend/utils/password').hashPassword;
      const User = require('../../src/backend/models/User');
      const UserRepository = require('../../src/backend/repositories/UserRepository');
      const userRepo = new UserRepository();
      
      const hash = await passwordHash('Password123');
      adminUser = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@test.com',
        password_hash: hash,
        role: 'admin',
      });
      adminUser = await userRepo.createWithId(adminUser);
    }

    // Create test regular user
    try {
      regularUser = await userService.getUserByUsername('testuser');
    } catch (error) {
      regularUser = await userService.createUser(
        {
          username: 'testuser',
          email: 'testuser@test.com',
          password: 'testpass123',
          role: 'user',
        },
        adminUser.id
      );
    }

    adminToken = generateToken(adminUser);
    userToken = generateToken(regularUser);
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'Password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.username).toBe('admin');
      expect(response.body.user.role).toBe('admin');
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with non-existent username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login without username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });

    it('should reject login without password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_CREDENTIALS');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.username).toBe('admin');
      expect(response.body.role).toBe('admin');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/users', () => {
    it('should create user when admin is authenticated', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newuser',
          email: 'newuser@test.com',
          password: 'newpass123',
          role: 'user',
        });

      expect(response.status).toBe(201);
      expect(response.body.username).toBe('newuser');
      expect(response.body.email).toBe('newuser@test.com');
      expect(response.body.role).toBe('user');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject user creation when non-admin is authenticated', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'anotheruser',
          email: 'anotheruser@test.com',
          password: 'pass123',
          role: 'user',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject user creation without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .send({
          username: 'anotheruser',
          email: 'anotheruser@test.com',
          password: 'pass123',
        });

      expect(response.status).toBe(401);
    });

    it('should reject user creation with duplicate username', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'admin',
          email: 'duplicate@test.com',
          password: 'pass123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject user creation with duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'uniqueuser',
          email: 'admin@test.com',
          password: 'pass123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject user creation without required fields', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'incomplete',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });
  });

  describe('PUT /api/auth/users/password', () => {
    it('should change password with correct current password', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'testpass123',
        });

      const token = loginResponse.body.token;

      const response = await request(app)
        .put('/api/auth/users/password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'testpass123',
          newPassword: 'newtestpass123',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify new password works
      const loginResponse2 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'newtestpass123',
        });

      expect(loginResponse2.status).toBe(200);

      // Change password back for other tests
      await request(app)
        .put('/api/auth/users/password')
        .set('Authorization', `Bearer ${loginResponse2.body.token}`)
        .send({
          currentPassword: 'newtestpass123',
          newPassword: 'testpass123',
        });
    });

    it('should reject password change with incorrect current password', async () => {
      const response = await request(app)
        .put('/api/auth/users/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'wrongpassword',
          newPassword: 'newpass123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should reject password change without authentication', async () => {
      const response = await request(app)
        .put('/api/auth/users/password')
        .send({
          currentPassword: 'oldpass',
          newPassword: 'newpass',
        });

      expect(response.status).toBe(401);
    });

    it('should reject password change without required fields', async () => {
      const response = await request(app)
        .put('/api/auth/users/password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          currentPassword: 'testpass123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });
  });
});

