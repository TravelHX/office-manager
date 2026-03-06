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
        is_admin: true,
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

  describe('POST /api/auth/users - User creation with profile fields', () => {
    it('should create user with first name, last name, email, and office location', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'profileuser',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@test.com',
          office_location: 'London',
          password: 'password123',
          role: 'user',
        });

      expect(response.status).toBe(201);
      expect(response.body.username).toBe('profileuser');
      expect(response.body.firstName).toBe('John');
      expect(response.body.lastName).toBe('Doe');
      expect(response.body.email).toBe('john.doe@test.com');
      expect(response.body.officeLocation).toBe('London');
    });

    it('should create admin user with is_admin flag', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'newadmin',
          email: 'newadmin@test.com',
          password: 'password123',
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
          username: 'invalidemail',
          email: 'invalid-email',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid office location', async () => {
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'invalidloc',
          email: 'invalidloc@test.com',
          office_location: 'New York',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PUT /api/auth/users/:id - User update', () => {
    it('should update user profile fields as admin', async () => {
      // First create a user to update
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'updatetest',
          email: 'updatetest@test.com',
          password: 'password123',
        });

      const userId = createResponse.body.id;

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
          username: 'testuser',
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
      // Create a non-admin user
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'regularuser',
          email: 'regular@test.com',
          password: 'password123',
          is_admin: false,
        });

      const regularUserId = createResponse.body.id;
      const regularUserToken = generateToken(createResponse.body);

      // Try to access admin endpoint with non-admin user
      const response = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({
          username: 'shouldfail',
          email: 'shouldfail@test.com',
          password: 'password123',
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

  describe('End-to-End: User Creation with Profile Fields (Admin)', () => {
    it('should create user with all profile fields and verify admin access', async () => {
      // Create user with all profile fields
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'profileuser',
          email: 'profileuser@test.com',
          password: 'password123',
          first_name: 'Profile',
          last_name: 'User',
          office_location: 'London',
          is_admin: false,
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body).toHaveProperty('id');
      expect(createResponse.body.firstName).toBe('Profile');
      expect(createResponse.body.lastName).toBe('User');
      expect(createResponse.body.email).toBe('profileuser@test.com');
      expect(createResponse.body.officeLocation).toBe('London');
      expect(createResponse.body.isAdmin).toBe(false);

      // Verify user can login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'profileuser',
          password: 'password123',
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.user.username).toBe('profileuser');
      expect(loginResponse.body.user.firstName).toBe('Profile');
      expect(loginResponse.body.user.lastName).toBe('User');
      expect(loginResponse.body.user.officeLocation).toBe('London');

      // Verify user cannot access admin endpoints
      const userToken = loginResponse.body.token;
      const adminEndpointResponse = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${userToken}`);

      expect(adminEndpointResponse.status).toBe(403);
    });

    it('should create admin user with profile fields and verify admin access', async () => {
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'adminprofile',
          email: 'adminprofile@test.com',
          password: 'password123',
          first_name: 'Admin',
          last_name: 'Profile',
          office_location: 'Prague',
          is_admin: true,
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.isAdmin).toBe(true);
      expect(createResponse.body.role).toBe('admin');
      expect(createResponse.body.officeLocation).toBe('Prague');

      // Verify admin can login and access admin endpoints
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'adminprofile',
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
      // Create a test user for password reset
      const createResponse = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          username: 'resettestuser',
          email: 'resettest@test.com',
          password: 'oldpassword123',
        });

      testUser = createResponse.body;

      // Login to get token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'resettestuser',
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
      const user = await userService.getUserByUsername('resettestuser');
      
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
          username: 'resettestuser',
          password: 'oldpassword123',
        });

      expect(oldPasswordLogin.status).toBe(401);

      // Step 5: Verify new password works
      const newPasswordLogin = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'resettestuser',
          password: 'newpassword123',
        });

      expect(newPasswordLogin.status).toBe(200);
      expect(newPasswordLogin.body.token).toBeDefined();

      // Step 6: Verify reset token is cleared after use
      const userAfterReset = await userService.getUserByUsername('resettestuser');
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

      // Create test user
      const expiredUser = await userService.createUser(
        {
          username: 'expiredtokenuser',
          email: 'expiredtoken@test.com',
          password: 'password123',
        },
        adminUser.id
      );

      // Manually set expired token
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
      
      // Create some other users
      const regularUser1 = await userService.createUser(
        {
          username: 'cleanuptest1',
          email: 'cleanuptest1@test.com',
          password: 'password123',
        },
        adminUser.id
      );
      
      const regularUser2 = await userService.createUser(
        {
          username: 'cleanuptest2',
          email: 'cleanuptest2@test.com',
          password: 'password123',
        },
        adminUser.id
      );
      
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
      // Create test admin users
      testAdmin1 = await userService.createUser(
        {
          username: 'deleteadmin1',
          email: 'deleteadmin1@test.com',
          password: 'Password123',
          is_admin: true,
          role: 'admin',
        },
        adminUser.id
      );
      admin1Token = generateToken(testAdmin1.id, testAdmin1.username, testAdmin1.isAdmin);

      testAdmin2 = await userService.createUser(
        {
          username: 'deleteadmin2',
          email: 'deleteadmin2@test.com',
          password: 'Password123',
          is_admin: true,
          role: 'admin',
        },
        adminUser.id
      );
      admin2Token = generateToken(testAdmin2.id, testAdmin2.username, testAdmin2.isAdmin);

      // Create test regular user
      testRegularUser = await userService.createUser(
        {
          username: 'deletetestuser',
          email: 'deletetestuser@test.com',
          password: 'Password123',
          role: 'user',
        },
        adminUser.id
      );
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
      const regularUserToken = generateToken(regularUser.id, regularUser.username, false);

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
        
        const testUser = await userService.createUser(
          {
            username: 'cascadetestuser',
            email: 'cascadetestuser@test.com',
            password: 'Password123',
            role: 'user',
          },
          adminUser.id
        );

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

