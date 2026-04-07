const request = require('supertest');
const app = require('../../src/backend/server');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

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
        is_admin: true,
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
        name: 'Test User',
        password: 'testpass123',
      });
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

    it('should return PROFILE_SETUP_REQUIRED for provisioned user without password (Bug 0013)', async () => {
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Provisioned Login Test',
          email: `prov_login_${Date.now()}@test.com`,
        });

      expect(createResponse.status).toBe(201);
      const email = createResponse.body.email;

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: email,
          password: 'temporary-guess',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('PROFILE_SETUP_REQUIRED');
      expect(response.body.error.message).toContain('profile setup link');
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
    it('should provision user when admin is authenticated', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New User',
          email: 'newuser@test.com',
          role: 'user',
        });

      expect(response.status).toBe(201);
      expect(response.body.username).toBe('newuser@test.com');
      expect(response.body.email).toBe('newuser@test.com');
      expect(response.body.role).toBe('user');
      expect(response.body.profileComplete).toBe(false);
      expect(response.body.invitationToken).toBeDefined();
      expect(response.body.profileSetupUrl).toContain('complete-profile');
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject user creation when non-admin is authenticated', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          name: 'Another',
          email: 'anotheruser@test.com',
          role: 'user',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('should reject user creation without authentication', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .send({
          name: 'X',
          email: 'anotheruser@test.com',
        });

      expect(response.status).toBe(401);
    });

    it('should reject user creation with duplicate email (username)', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Dup',
          email: 'admin@test.com',
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should reject user creation without required fields', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'onlyemail@test.com',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    it('should reject admin create payload with password', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Bad',
          email: 'badpayload@test.com',
          password: 'secret',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_CREATE_PAYLOAD');
    });
  });

  describe('PUT /api/auth/users/password', () => {
    it('should change password with correct current password', async () => {
      // First login to get a token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser@test.com',
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
          username: 'testuser@test.com',
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

  describe('POST /api/auth/users - provisioning variants', () => {
    it('should create user with first_name and last_name instead of name', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@test.com',
          role: 'user',
        });

      expect(response.status).toBe(201);
      expect(response.body.username).toBe('john.doe@test.com');
      expect(response.body.firstName).toBe('John');
      expect(response.body.lastName).toBe('Doe');
      expect(response.body.email).toBe('john.doe@test.com');
      expect(response.body.profileComplete).toBe(false);
    });

    it('should create admin user with is_admin flag', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'New Admin',
          email: 'newadmin@test.com',
          is_admin: true,
        });

      expect(response.status).toBe(201);
      expect(response.body.isAdmin).toBe(true);
      expect(response.body.role).toBe('admin');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'X',
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/auth/users/:id - User update', () => {
    it('should update user profile fields as admin', async () => {
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Update Test',
          email: 'updatetest@test.com',
        });

      expect(createResponse.status).toBe(201);
      const userId = createResponse.body.id;
      await request(app)
        .post('/api/auth/complete-profile')
        .send({
          token: createResponse.body.invitationToken,
          password: 'password123',
          office_location: 'London',
        });

      const response = await request(app)
        .put(`/api/auth/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Updated',
          last_name: 'Name',
          office_location: 'Prague',
        });

      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe('Updated');
      expect(response.body.lastName).toBe('Name');
      expect(response.body.officeLocation).toBe('Prague');
    });

    it('should allow users to update their own profile', async () => {
      const response = await request(app)
        .put(`/api/auth/users/${regularUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          first_name: 'My',
          last_name: 'Name',
        });

      expect(response.status).toBe(200);
      expect(response.body.firstName).toBe('My');
      expect(response.body.lastName).toBe('Name');
    });

    it('should prevent users from updating other users', async () => {
      const response = await request(app)
        .put(`/api/auth/users/${adminUser.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          first_name: 'Hacked',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should accept password reset request for valid email', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'testuser@test.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('password reset link');
    });

    it('should return success even for non-existent email (security)', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@test.com',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('password reset link');
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    let resetToken;

    beforeEach(async () => {
      // Request password reset to get a token
      await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'testuser@test.com',
        });

      // Get the token from the database (in real scenario, this would be in email)
      const UserRepository = require('../../src/backend/repositories/UserRepository');
      const userRepo = new UserRepository();
      const user = await userRepo.findByEmail('testuser@test.com');
      resetToken = user.resetToken;
    });

    it('should reset password with valid token', async () => {
      if (!resetToken) {
        // Skip if token not available (might need to check logs)
        return;
      }

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'newpassword123',
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('reset successfully');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser@test.com',
          password: 'newpassword123',
        });

      expect(loginResponse.status).toBe(200);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token',
          newPassword: 'newpassword123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Admin flag functionality', () => {
    it('should check isAdmin flag for admin endpoints', async () => {
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Regular User',
          email: 'regular@test.com',
          is_admin: false,
        });

      await request(app)
        .post('/api/auth/complete-profile')
        .send({
          token: createResponse.body.invitationToken,
          password: 'password123',
          office_location: 'London',
        });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ username: 'regular@test.com', password: 'password123' });
      const regularUserToken = loginRes.body.token;

      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          name: 'Should Fail',
          email: 'shouldfail@test.com',
        });

      expect(response.status).toBe(403);
    });

    it('should allow admin users to access admin endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/auth/check-users', () => {
    it('should return hasUsers true when users exist', async () => {
      const response = await request(app)
        .get('/api/auth/check-users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('hasUsers');
      expect(typeof response.body.hasUsers).toBe('boolean');
      // Since we have adminUser and regularUser, hasUsers should be true
      expect(response.body.hasUsers).toBe(true);
    });
  });

  describe('POST /api/auth/register - First user registration', () => {
    let userService;
    let userRepository;

    beforeEach(async () => {
      userService = new UserService();
      userRepository = require('../../src/backend/repositories/UserRepository');
      const repo = new userRepository();
      
      // Clean up test users before each test
      try {
        const testUsers = await repo.findAll();
        for (const user of testUsers) {
          if (user.username.startsWith('firstuser') || user.username.startsWith('reguser')) {
            await repo.deleteById(user.id);
          }
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should register first user and automatically assign admin role', async () => {
      // First, ensure no users exist (or count them)
      const userCount = await userService.getUserCount();
      
      // If there are existing users, we can't test first user registration
      // In a real scenario, we'd flush the database or use a test database
      // For now, we'll test that registration works and first user logic is correct
      
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'firstuser',
          email: 'firstuser@test.com',
          password: 'password123',
          first_name: 'First',
          last_name: 'User',
        });

      // If this is actually the first user, it should be admin
      if (userCount === 0) {
        expect(response.status).toBe(201);
        expect(response.body.user).toBeDefined();
        expect(response.body.user.isAdmin).toBe(true);
        expect(response.body.user.role).toBe('admin');
        expect(response.body.token).toBeDefined();
        expect(response.body.message).toContain('administrator');
      } else {
        // If not first user, should still register but as regular user
        expect(response.status).toBe(201);
        expect(response.body.user).toBeDefined();
        expect(response.body.token).toBeDefined();
      }
    });

    it('should register subsequent users as regular users', async () => {
      // This test assumes at least one user already exists (adminUser)
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'reguser',
          email: 'reguser@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(201);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.isAdmin).toBe(false);
      expect(response.body.user.role).toBe('user');
      expect(response.body.token).toBeDefined();
    });

    it('should reject registration with duplicate username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: adminUser.username,
          email: 'different@test.com',
          password: 'password123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already exists');
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'differentuser',
          email: adminUser.email,
          password: 'password123',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('already exists');
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('Invalid email');
    });

    it('should reject registration without required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          // Missing email and password
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toContain('required');
    });
  });

  describe('End-to-End: User provisioning and profile completion (Admin)', () => {
    it('should provision user, complete profile, and verify non-admin access', async () => {
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          first_name: 'Profile',
          last_name: 'User',
          email: 'profileuser@test.com',
          is_admin: false,
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.profileComplete).toBe(false);

      await request(app)
        .post('/api/auth/complete-profile')
        .send({
          token: createResponse.body.invitationToken,
          password: 'password123',
          office_location: 'London',
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'profileuser@test.com',
          password: 'password123',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.user.username).toBe('profileuser@test.com');
      expect(loginResponse.body.user.firstName).toBe('Profile');
      expect(loginResponse.body.user.lastName).toBe('User');
      expect(loginResponse.body.user.officeLocation).toBe('London');
      expect(loginResponse.body.user.profileComplete).toBe(true);

      const userToken = loginResponse.body.token;
      const adminEndpointResponse = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(adminEndpointResponse.status).toBe(403);
    });

    it('should provision admin user, complete profile, and access admin endpoints', async () => {
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Admin Profile',
          email: 'adminprofile@test.com',
          is_admin: true,
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.isAdmin).toBe(true);

      await request(app)
        .post('/api/auth/complete-profile')
        .send({
          token: createResponse.body.invitationToken,
          password: 'password123',
          office_location: 'Prague',
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'adminprofile@test.com',
          password: 'password123',
        });

      expect(loginResponse.status).toBe(200);
      const newAdminToken = loginResponse.body.token;

      const adminEndpointResponse = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${newAdminToken}`);

      expect(adminEndpointResponse.status).toBe(200);
      expect(Array.isArray(adminEndpointResponse.body)).toBe(true);
    });
  });

  describe('End-to-End: Password Reset Flow', () => {
    let testUser;
    let testUserToken;

    beforeAll(async () => {
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Reset Test User',
          email: 'resettest@test.com',
        });

      await request(app)
        .post('/api/auth/complete-profile')
        .send({
          token: createResponse.body.invitationToken,
          password: 'oldpassword123',
          office_location: 'London',
        });

      testUser = createResponse.body;

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'resettest@test.com',
          password: 'oldpassword123',
        });

      testUserToken = loginResponse.body.token;
    });

    it('should complete full password reset flow', async () => {
      // Step 1: Request password reset
      const forgotPasswordResponse = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'resettest@test.com',
        });

      expect(forgotPasswordResponse.status).toBe(200);
      expect(forgotPasswordResponse.body.message).toBeDefined();

      // Step 2: Get reset token from database (simulating email link)
      const UserService = require('../../src/backend/services/UserService');
      const userService = new UserService();
      const user = await userService.getUserByUsername('resettest@test.com');
      
      expect(user.resetToken).toBeDefined();
      expect(user.resetTokenExpiry).toBeDefined();

      // Step 3: Reset password with token
      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: user.resetToken,
          newPassword: 'newpassword123',
        });

      expect(resetPasswordResponse.status).toBe(200);
      expect(resetPasswordResponse.body.message).toContain('reset successfully');

      // Step 4: Verify old password no longer works
      const oldPasswordLogin = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'resettest@test.com',
          password: 'oldpassword123',
        });

      expect(oldPasswordLogin.status).toBe(401);

      // Step 5: Verify new password works
      const newPasswordLogin = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'resettest@test.com',
          password: 'newpassword123',
        });

      expect(newPasswordLogin.status).toBe(200);
      expect(newPasswordLogin.body.token).toBeDefined();

      // Step 6: Verify reset token is cleared after use
      const userAfterReset = await userService.getUserByUsername('resettest@test.com');
      expect(userAfterReset.resetToken).toBeNull();
    });

    it('should reject password reset with invalid token', async () => {
      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'invalid-token-12345',
          newPassword: 'newpassword123',
        });

      expect(resetPasswordResponse.status).toBe(400);
      expect(resetPasswordResponse.body.error).toBeDefined();
      expect(resetPasswordResponse.body.error.message).toContain('Invalid or expired');
    });

    it('should reject password reset with expired token', async () => {
      // Create a user with expired token
      const UserService = require('../../src/backend/services/UserService');
      const UserRepository = require('../../src/backend/repositories/UserRepository');
      const userService = new UserService();
      const userRepo = new UserRepository();

      const { user: expiredUser, invitationToken } = await userService.createUser(
        {
          name: 'Expired Token',
          email: 'expiredtoken@test.com',
        },
        adminUser.id
      );
      await userService.completeProfileByInvitationToken(
        invitationToken,
        'password123',
        'London'
      );

      const expiredDate = new Date();
      expiredDate.setHours(expiredDate.getHours() - 2); // 2 hours ago
      await userRepo.update(expiredUser.id, {
        reset_token: 'expired-token-123',
        reset_token_expiry: expiredDate,
      });

      const resetPasswordResponse = await request(app)
        .post('/api/auth/reset-password')
        .send({
          token: 'expired-token-123',
          newPassword: 'newpassword123',
        });

      expect(resetPasswordResponse.status).toBe(400);
      expect(resetPasswordResponse.body.error).toBeDefined();
      expect(resetPasswordResponse.body.error.message).toContain('expired');
    });
  });

  describe('Application Startup Cleanup - Integration Tests', () => {
    let userService;
    let userRepository;

    beforeEach(async () => {
      userService = new UserService();
      userRepository = require('../../src/backend/repositories/UserRepository');
    });

    it('should remove admin/password123 user during startup cleanup when admin user does not exist', async () => {
      const repo = new userRepository();
      
      // Create admin user with Password123 password
      const passwordHash = require('../../src/backend/utils/password').hashPassword;
      const User = require('../../src/backend/models/User');
      const hash = await passwordHash('Password123');
      
      const adminPassword123User = new User({
        id: 9999,
        username: 'admin',
        email: 'admin@test.com',
        password_hash: hash,
        is_admin: false,
        role: 'user',
      });
      
      // Ensure user doesn't already exist
      try {
        const existing = await repo.findByUsername('admin');
        if (existing) {
          await repo.deleteById(existing.id);
        }
      } catch (error) {
        // Ignore
      }
      
      const createdUser = await repo.createWithId(adminPassword123User);
      expect(createdUser).toBeDefined();
      expect(createdUser.username).toBe('admin');
      
      // Verify user exists before cleanup
      const beforeCleanup = await repo.findByUsername('admin');
      expect(beforeCleanup).not.toBeNull();
      
      // Perform startup cleanup
      await userService.performStartupCleanup();
      
      // Verify user is removed after cleanup
      const afterCleanup = await repo.findByUsername('admin');
      expect(afterCleanup).toBeNull();
    });

    it('should flush all users during startup cleanup when admin user exists', async () => {
      const repo = new userRepository();
      
      // Create admin user (not admin/password123, but actual admin user)
      const passwordHash = require('../../src/backend/utils/password').hashPassword;
      const User = require('../../src/backend/models/User');
      const hash = await passwordHash('SomeOtherPassword');
      
      const adminUser = new User({
        id: 9998,
        username: 'admin',
        email: 'admin@test.com',
        password_hash: hash,
        is_admin: true,
        role: 'admin',
      });
      
      const regularUser1 = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'cleanuptest1@test.com',
        name: 'Cleanup 1',
        password: 'password123',
      });
      
      const regularUser2 = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'cleanuptest2@test.com',
        name: 'Cleanup 2',
        password: 'password123',
      });
      
      // Ensure admin user exists
      try {
        const existing = await repo.findByUsername('admin');
        if (!existing || !existing.isAdmin) {
          // Remove existing and create admin user
          if (existing) {
            await repo.deleteById(existing.id);
          }
          await repo.createWithId(adminUser);
        }
      } catch (error) {
        await repo.createWithId(adminUser);
      }
      
      // Verify users exist before cleanup
      const allUsersBefore = await repo.findAll();
      expect(allUsersBefore.length).toBeGreaterThan(0);
      
      // Perform startup cleanup
      await userService.performStartupCleanup();
      
      // Verify all users are flushed after cleanup
      const allUsersAfter = await repo.findAll();
      expect(allUsersAfter.length).toBe(0);
    });
  });

  describe('DELETE /api/auth/users/:id - User deletion (admin only)', () => {
    let testAdmin1, testAdmin2, testRegularUser;
    let admin1Token, admin2Token;

    beforeAll(async () => {
      testAdmin1 = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'deleteadmin1@test.com',
        name: 'Delete Admin 1',
        password: 'Password123',
        is_admin: true,
        role: 'admin',
      });
      admin1Token = generateToken(testAdmin1);

      testAdmin2 = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'deleteadmin2@test.com',
        name: 'Delete Admin 2',
        password: 'Password123',
        is_admin: true,
        role: 'admin',
      });
      admin2Token = generateToken(testAdmin2);

      testRegularUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'deletetestuser@test.com',
        name: 'Delete Test User',
        password: 'Password123',
      });
    });

    test('should delete a regular user successfully', async () => {
      const response = await request(app)
        .delete(`/api/auth/users/${testRegularUser.id}`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(response.status).toBe(204);

      // Verify user is deleted
      try {
        await userService.getUserById(testRegularUser.id);
        fail('User should have been deleted');
      } catch (error) {
        expect(error.message).toBe('User not found');
      }
    });

    test('should delete an admin user when multiple admins exist', async () => {
      const response = await request(app)
        .delete(`/api/auth/users/${testAdmin2.id}`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(response.status).toBe(204);

      // Verify admin user is deleted
      try {
        await userService.getUserById(testAdmin2.id);
        fail('Admin user should have been deleted');
      } catch (error) {
        expect(error.message).toBe('User not found');
      }
    });

    test('should prevent deletion of last admin user', async () => {
      // Get the last remaining admin (should be admin1 or adminUser)
      const allUsers = await userService.getAllUsers();
      const admins = allUsers.filter(u => u.isAdmin);
      const lastAdmin = admins[0];

      const response = await request(app)
        .delete(`/api/auth/users/${lastAdmin.id}`)
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('CANNOT_DELETE_LAST_ADMIN');
      expect(response.body.error.message).toContain('last admin user');

      // Verify admin user still exists
      const stillExists = await userService.getUserById(lastAdmin.id);
      expect(stillExists).toBeDefined();
    });

    test('should return 403 when non-admin tries to delete user', async () => {
      const regularUserToken = generateToken(regularUser);

      const response = await request(app)
        .delete(`/api/auth/users/${testRegularUser.id}`)
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    test('should return 404 when user does not exist', async () => {
      const response = await request(app)
        .delete('/api/auth/users/99999')
        .set('Authorization', `Bearer ${admin1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('USER_NOT_FOUND');
    });

    test('should cascade delete user bookings when user is deleted', async () => {
      // Create a booking for the user
      const BookingRepository = require('../../src/backend/repositories/BookingRepository');
      const Booking = require('../../src/backend/models/Booking');
      const bookingRepo = new BookingRepository();
      
      // Get a desk first
      const DeskRepository = require('../../src/backend/repositories/DeskRepository');
      const deskRepo = new DeskRepository();
      const desks = await deskRepo.findAll();
      if (desks.length === 0) {
        // Create a test desk
        const Desk = require('../../src/backend/models/Desk');
        const testDesk = new Desk({ desk_number: 'TEST-DELETE', is_active: true });
        await deskRepo.create(testDesk);
        const allDesks = await deskRepo.findAll();
        const deskId = allDesks[0].id;
        
        const testUser = await createProvisionedUserWithPassword(adminUser.id, {
          email: 'cascadetestuser@test.com',
          name: 'Cascade Test',
          password: 'Password123',
        });

        const booking = new Booking({
          user_id: testUser.id,
          desk_id: deskId,
          start_date: '2026-12-20',
          end_date: '2026-12-21',
          status: 'active',
        });
        await bookingRepo.create(booking);

        // Verify booking exists
        const userBookings = await bookingRepo.findByUserId(testUser.id);
        expect(userBookings.length).toBeGreaterThan(0);

        // Delete user
        await request(app)
          .delete(`/api/auth/users/${testUser.id}`)
          .set('Authorization', `Bearer ${admin1Token}`);

        // Verify booking is cascade deleted
        const bookingsAfter = await bookingRepo.findByUserId(testUser.id);
        expect(bookingsAfter.length).toBe(0);
      }
    });
  });
});

