const request = require('supertest');
const app = require('../../src/backend/server');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

describe('Access Control', () => {
  let userService;
  let adminUser;
  let regularUser;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    userService = new UserService();

    // Get or create test users
    try {
      adminUser = await userService.getUserByUsername('admin');
    } catch (error) {
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
        profile_complete: true,
      });
      adminUser = await userRepo.createWithId(adminUser);
    }

    try {
      regularUser = await userService.getUserByUsername('testuser@test.com');
    } catch (error) {
      regularUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'testuser@test.com',
        name: 'Access Test User',
        password: 'testpass123',
      });
    }

    adminToken = generateToken(adminUser);
    userToken = generateToken(regularUser);
  });

  describe('Public Endpoints (No Authentication Required)', () => {
    it('should allow viewing available desks without authentication', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const startDate = futureDate.toISOString().split('T')[0];
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should allow viewing available parking spaces without authentication', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const reservationDate = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .get(`/api/parking-spaces/available?reservationDate=${reservationDate}&timePeriod=morning`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Protected Endpoints (Authentication Required)', () => {
    it('should require authentication for booking a desk', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const startDate = futureDate.toISOString().split('T')[0];
      futureDate.setDate(futureDate.getDate() + 1);
      const endDate = futureDate.toISOString().split('T')[0];

      const response = await request(app)
        .post('/api/bookings')
        .send({
          deskId: 1,
          startDate: startDate,
          endDate: endDate,
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('should require authentication for viewing my bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/my-bookings');

      expect(response.status).toBe(401);
    });

    it('should allow authenticated users to access protected endpoints', async () => {
      const response = await request(app)
        .get('/api/bookings/my-bookings')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Admin-Only Endpoints', () => {
    it('should allow admin to access admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/configuration')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
    });

    it('should reject non-admin users from admin endpoints', async () => {
      const response = await request(app)
        .get('/api/admin/configuration')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should allow admin to create users', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'admincreated',
          email: 'admincreated@test.com',
          password: 'pass123',
          role: 'user',
        });

      expect(response.status).toBe(201);
    });

    it('should reject non-admin from creating users', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          username: 'usercreated',
          email: 'usercreated@test.com',
          password: 'pass123',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('User-Specific Data Access', () => {
    it('should allow users to access their own bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/my-bookings')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      // All bookings returned should belong to the authenticated user
      response.body.forEach(booking => {
        expect(booking.userId).toBe(regularUser.id);
      });
    });

  });
});

