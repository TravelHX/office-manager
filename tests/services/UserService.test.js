const UserService = require('../../src/backend/services/UserService');
const UserRepository = require('../../src/backend/repositories/UserRepository');
const User = require('../../src/backend/models/User');
const { hashPassword, verifyPassword } = require('../../src/backend/utils/password');

// Mock the UserRepository
jest.mock('../../src/backend/repositories/UserRepository');

describe('User model parseIsAdmin (Bug 0012)', () => {
  it('treats string 0 as non-admin', () => {
    const u = new User({ username: 'x', is_admin: '0', role: 'user' });
    expect(u.isAdmin).toBe(false);
  });

  it('treats string 1 as admin', () => {
    const u = new User({ username: 'x', is_admin: '1', role: 'admin' });
    expect(u.isAdmin).toBe(true);
  });

  it('treats numeric 1 as admin', () => {
    const u = new User({ username: 'x', is_admin: 1 });
    expect(u.isAdmin).toBe(true);
  });
});

describe('UserService', () => {
  let userService;
  let mockUserRepository;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      findByInvitationToken: jest.fn(),
      create: jest.fn(),
      createWithId: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      executeRawQuery: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      countAdmins: jest.fn(),
      deleteById: jest.fn(),
      deleteByUsername: jest.fn(),
      deleteAll: jest.fn(),
    };

    UserRepository.mockImplementation(() => mockUserRepository);
    userService = new UserService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createUser (admin provisioning)', () => {
    it('should provision a user with email and name and return invitation token', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
        profileComplete: true,
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockImplementation(async (u) => {
        const row = u instanceof User ? u : new User(u);
        row.id = 1;
        return row;
      });

      const result = await userService.createUser(
        { email: 'newuser@example.com', name: 'New User', role: 'user' },
        1000
      );

      expect(result.user).toBeDefined();
      expect(result.invitationToken).toBeDefined();
      expect(result.user.email).toBe('newuser@example.com');
      expect(result.user.username).toBe('newuser@example.com');
      expect(result.user.profileComplete).toBe(false);
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should reject forbidden fields from admin create payload', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById.mockResolvedValue(creator);

      await expect(
        userService.createUser({ email: 'a@b.com', name: 'A', password: 'x' }, 1000)
      ).rejects.toThrow('Admin user creation accepts only');
    });

    it('should throw error if creator is not admin', async () => {
      const creator = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        isAdmin: false,
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(creator);

      await expect(
        userService.createUser({ email: 'new@example.com', name: 'N' }, 1)
      ).rejects.toThrow('Only admins can create users');
    });

    it('should throw error if email username already exists', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      const existingUser = new User({
        id: 2,
        username: 'taken@example.com',
        email: 'taken@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(existingUser);

      await expect(
        userService.createUser({ email: 'taken@example.com', name: 'Taken' }, 1000)
      ).rejects.toThrow('A user with this email already exists');
    });

    it('should throw error if email already exists', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      const existingUser = new User({
        id: 2,
        username: 'other',
        email: 'existing@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      await expect(
        userService.createUser({ email: 'existing@example.com', name: 'X' }, 1000)
      ).rejects.toThrow('Email already exists');
    });
  });

  describe('changePassword', () => {
    it('should change password when current password is correct', async () => {
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: await hashPassword('oldpassword'),
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(user);
      mockUserRepository.updatePassword.mockResolvedValue(user);

      await userService.changePassword(1, 'oldpassword', 'newpassword');

      expect(mockUserRepository.updatePassword).toHaveBeenCalled();
    });

    it('should throw error if current password is incorrect', async () => {
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: await hashPassword('correctpassword'),
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(user);

      await expect(
        userService.changePassword(1, 'wrongpassword', 'newpassword')
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw error if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(
        userService.changePassword(999, 'oldpassword', 'newpassword')
      ).rejects.toThrow('User not found');
    });
  });

  describe('authenticate', () => {
    it('should authenticate user with correct credentials', async () => {
      const passwordHash = await hashPassword('password123');
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: passwordHash,
        role: 'user',
      });

      mockUserRepository.findByUsername.mockResolvedValue(user);

      const result = await userService.authenticate('user', 'password123');

      expect(result).toBeDefined();
      expect(result.username).toBe('user');
    });

    it('should throw error if username is incorrect', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      await expect(
        userService.authenticate('nonexistent', 'password123')
      ).rejects.toThrow('Invalid username or password');
    });

    it('should throw error if password is incorrect', async () => {
      const passwordHash = await hashPassword('correctpassword');
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: passwordHash,
        role: 'user',
      });

      mockUserRepository.findByUsername.mockResolvedValue(user);

      await expect(
        userService.authenticate('user', 'wrongpassword')
      ).rejects.toThrow('Invalid username or password');
    });

    it('should reject login when user has no password (provisioned) with PROFILE_SETUP_REQUIRED', async () => {
      const user = new User({
        id: 1,
        username: 'u@example.com',
        email: 'u@example.com',
        passwordHash: null,
        role: 'user',
      });

      mockUserRepository.findByUsername.mockResolvedValue(user);

      await expect(
        userService.authenticate('u@example.com', 'any')
      ).rejects.toThrow('PROFILE_SETUP_REQUIRED');
    });
  });

  describe('performLogin', () => {
    it('returns unknown_user when email not found', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const r = await userService.performLogin('nobody@example.com', 'x');
      expect(r.type).toBe('unknown_user');
    });

    it('returns needs_setup with profile URL when provisioned with valid invitation', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 7);
      const user = new User({
        id: 1,
        username: 'u@example.com',
        email: 'u@example.com',
        passwordHash: null,
        invitation_token: 'tok123',
        invitation_token_expiry: future,
        role: 'user',
      });

      mockUserRepository.findByUsername.mockResolvedValue(user);

      const r = await userService.performLogin('u@example.com', 'anything');
      expect(r.type).toBe('needs_setup');
      expect(r.profileSetupUrl).toContain('complete-profile.html');
      expect(r.profileSetupUrl).toContain(encodeURIComponent('tok123'));
    });

    it('returns setup_expired when invitation is missing or expired', async () => {
      const past = new Date();
      past.setDate(past.getDate() - 1);
      const user = new User({
        id: 1,
        username: 'u@example.com',
        email: 'u@example.com',
        passwordHash: null,
        invitation_token: 'tok',
        invitation_token_expiry: past,
        role: 'user',
      });
      mockUserRepository.findByUsername.mockResolvedValue(user);

      const r = await userService.performLogin('u@example.com', 'x');
      expect(r.type).toBe('setup_expired');
    });

    it('returns invalid_credentials when password wrong', async () => {
      const passwordHash = await hashPassword('good');
      const user = new User({
        id: 1,
        username: 'u@example.com',
        email: 'u@example.com',
        passwordHash,
        role: 'user',
      });
      mockUserRepository.findByUsername.mockResolvedValue(user);

      const r = await userService.performLogin('u@example.com', 'bad');
      expect(r.type).toBe('invalid_credentials');
    });

    it('returns success when password correct', async () => {
      const passwordHash = await hashPassword('good');
      const user = new User({
        id: 1,
        username: 'u@example.com',
        email: 'u@example.com',
        passwordHash,
        role: 'user',
      });
      mockUserRepository.findByUsername.mockResolvedValue(user);

      const r = await userService.performLogin('u@example.com', 'good');
      expect(r.type).toBe('success');
      expect(r.user.username).toBe('u@example.com');
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await userService.getUserById(1);

      expect(result).toBeDefined();
      expect(result.id).toBe(1);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getUserById(999)).rejects.toThrow('User not found');
    });
  });

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      const users = [
        new User({ id: 1, username: 'user1', email: 'user1@example.com', passwordHash: 'hash', role: 'user' }),
        new User({ id: 2, username: 'user2', email: 'user2@example.com', passwordHash: 'hash', role: 'user' }),
      ];

      mockUserRepository.findAll.mockResolvedValue(users);

      const result = await userService.getAllUsers();

      expect(result).toHaveLength(2);
      expect(mockUserRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('completeProfileByInvitationToken', () => {
    it('should set password, office, and clear invitation', async () => {
      const pending = new User({
        id: 5,
        username: 'u@example.com',
        email: 'u@example.com',
        passwordHash: null,
        profileComplete: false,
        invitationToken: 'tok',
        invitationTokenExpiry: new Date(Date.now() + 3600000),
      });

      mockUserRepository.findByInvitationToken.mockResolvedValue(pending);
      mockUserRepository.executeRawQuery.mockResolvedValue(undefined);
      const done = new User({
        id: 5,
        username: 'u@example.com',
        email: 'u@example.com',
        passwordHash: 'hashed',
        officeLocation: 'London',
        profileComplete: true,
        invitationToken: null,
      });
      mockUserRepository.findById.mockResolvedValue(done);

      const out = await userService.completeProfileByInvitationToken('tok', 'newpass123', 'London');
      expect(out.profileComplete).toBe(true);
      expect(mockUserRepository.executeRawQuery).toHaveBeenCalled();
    });
  });

  describe('updateUser', () => {
    beforeEach(() => {
      mockUserRepository.findByResetToken = jest.fn();
    });

    it('should update user profile fields', async () => {
      const updater = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      const userToUpdate = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      const updatedUser = new User({
        id: 1,
        username: 'user',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'user@example.com',
        officeLocation: 'Prague',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById
        .mockResolvedValueOnce(updater)
        .mockResolvedValueOnce(userToUpdate)
        .mockResolvedValueOnce(updatedUser);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(1, {
        first_name: 'Jane',
        last_name: 'Smith',
        office_location: 'Prague',
      }, 1000);

      expect(result).toBeDefined();
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should allow users to update their own profile', async () => {
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      const updatedUser = new User({
        id: 1,
        username: 'user',
        firstName: 'Updated',
        email: 'user@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(updatedUser);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.updateUser(1, {
        first_name: 'Updated',
      }, 1);

      expect(result).toBeDefined();
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should prevent non-admin users from updating other users', async () => {
      const updater = new User({
        id: 1,
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      const userToUpdate = new User({
        id: 2,
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById
        .mockResolvedValueOnce(updater)
        .mockResolvedValueOnce(userToUpdate);

      await expect(
        userService.updateUser(2, { first_name: 'Updated' }, 1)
      ).rejects.toThrow('You can only update your own profile');
    });
  });

  describe('requestPasswordReset', () => {
    beforeEach(() => {
      mockUserRepository.findByResetToken = jest.fn();
    });

    it('should generate reset token for valid email', async () => {
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findByEmail.mockResolvedValue(user);
      mockUserRepository.update.mockResolvedValue(user);

      await userService.requestPasswordReset('user@example.com');

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('user@example.com');
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should not throw error for non-existent email (security)', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(userService.requestPasswordReset('nonexistent@example.com')).resolves.not.toThrow();
    });

    it('should throw error for invalid email format', async () => {
      await expect(userService.requestPasswordReset('invalid-email')).rejects.toThrow('Valid email address is required');
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      mockUserRepository.findByResetToken = jest.fn();
    });

    it('should reset password with valid token', async () => {
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'oldhash',
        resetToken: 'valid-token',
        resetTokenExpiry: new Date(Date.now() + 3600000), // 1 hour from now
        role: 'user',
      });

      const updatedUser = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'newhash',
        role: 'user',
      });

      mockUserRepository.findByResetToken.mockResolvedValue(user);
      mockUserRepository.updatePassword.mockResolvedValue(updatedUser);
      mockUserRepository.findById.mockResolvedValue(updatedUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await userService.resetPassword('valid-token', 'newpassword123');

      expect(result).toBeDefined();
      expect(mockUserRepository.findByResetToken).toHaveBeenCalledWith('valid-token');
      expect(mockUserRepository.updatePassword).toHaveBeenCalled();
    });

    it('should throw error for invalid token', async () => {
      mockUserRepository.findByResetToken.mockResolvedValue(null);

      await expect(
        userService.resetPassword('invalid-token', 'newpassword123')
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw error for expired token', async () => {
      const user = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        resetToken: 'expired-token',
        resetTokenExpiry: new Date(Date.now() - 3600000), // 1 hour ago
        role: 'user',
      });

      mockUserRepository.findByResetToken.mockResolvedValue(user);

      await expect(
        userService.resetPassword('expired-token', 'newpassword123')
      ).rejects.toThrow('Reset token has expired');
    });
  });

  describe('getUserCount', () => {
    it('should return total user count', async () => {
      mockUserRepository.count.mockResolvedValue(5);

      const count = await userService.getUserCount();

      expect(count).toBe(5);
      expect(mockUserRepository.count).toHaveBeenCalled();
    });

    it('should return 0 when no users exist', async () => {
      mockUserRepository.count.mockResolvedValue(0);

      const count = await userService.getUserCount();

      expect(count).toBe(0);
    });

    it('should coerce string COUNT from driver to number (Bug 0012)', async () => {
      mockUserRepository.count.mockResolvedValue('0');

      const count = await userService.getUserCount();

      expect(count).toBe(0);
    });
  });

  describe('hasUsers', () => {
    it('should return true when users exist', async () => {
      mockUserRepository.count.mockResolvedValue(1);

      const hasUsers = await userService.hasUsers();

      expect(hasUsers).toBe(true);
    });

    it('should return false when no users exist', async () => {
      mockUserRepository.count.mockResolvedValue(0);

      const hasUsers = await userService.hasUsers();

      expect(hasUsers).toBe(false);
    });
  });

  describe('registerUser', () => {
    it('should register first user and automatically assign admin role', async () => {
      mockUserRepository.count.mockResolvedValue(0);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      
      const newUser = new User({
        id: 1,
        username: 'firstuser',
        email: 'firstuser@example.com',
        passwordHash: 'hashed',
        isAdmin: true,
        role: 'admin',
      });
      mockUserRepository.create.mockResolvedValue(newUser);

      const userData = {
        username: 'firstuser',
        email: 'firstuser@example.com',
        password: 'password123',
      };

      const result = await userService.registerUser(userData);

      expect(result).toBeDefined();
      expect(result.isAdmin).toBe(true);
      expect(result.role).toBe('admin');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should treat string zero user count as first user and assign admin (Bug 0012)', async () => {
      mockUserRepository.count.mockResolvedValue('0');
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const newUser = new User({
        id: 1,
        username: 'first@example.com',
        email: 'first@example.com',
        passwordHash: 'hashed',
        isAdmin: true,
        role: 'admin',
      });
      mockUserRepository.create.mockResolvedValue(newUser);

      const result = await userService.registerUser({
        email: 'first@example.com',
        password: 'password123',
      });

      expect(result.isAdmin).toBe(true);
      expect(result.role).toBe('admin');
      const createdArg = mockUserRepository.create.mock.calls[0][0];
      expect(createdArg.isAdmin).toBe(true);
      expect(createdArg.role).toBe('admin');
    });

    it('should reject self-registration when any user already exists', async () => {
      mockUserRepository.count.mockResolvedValue(1);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        userService.registerUser({
          username: 'seconduser',
          email: 'seconduser@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Self-service registration is not available');
    });

    it('should throw error if username already exists', async () => {
      mockUserRepository.count.mockResolvedValue(0);
      mockUserRepository.findByUsername.mockResolvedValue(new User({ id: 1, username: 'existing' }));

      await expect(
        userService.registerUser({
          username: 'existing',
          email: 'new@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Username already exists');
    });

    it('should throw error if email already exists', async () => {
      mockUserRepository.count.mockResolvedValue(0);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(new User({ id: 1, email: 'existing@example.com' }));

      await expect(
        userService.registerUser({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Email already exists');
    });

    it('should validate email format', async () => {
      mockUserRepository.count.mockResolvedValue(0);

      await expect(
        userService.registerUser({
          username: 'newuser',
          email: 'invalid-email',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid email format');
    });

    it('should validate office location', async () => {
      mockUserRepository.count.mockResolvedValue(0);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(
        userService.registerUser({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          office_location: 'InvalidLocation',
        })
      ).rejects.toThrow('Invalid office location');
    });
  });

  describe('cleanupAdminPassword123User', () => {
    it('should remove admin user with Password123 password', async () => {
      const adminUser = new User({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword('Password123'),
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findByUsername.mockResolvedValue(adminUser);
      mockUserRepository.deleteById.mockResolvedValue();

      await userService.cleanupAdminPassword123User();

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('admin');
      expect(mockUserRepository.deleteById).toHaveBeenCalledWith(1);
    });

    it('should not remove admin user with different password', async () => {
      const adminUser = new User({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: await hashPassword('DifferentPassword'),
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findByUsername.mockResolvedValue(adminUser);

      await userService.cleanupAdminPassword123User();

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('admin');
      expect(mockUserRepository.deleteById).not.toHaveBeenCalled();
    });

    it('should handle case when admin user does not exist', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      await userService.cleanupAdminPassword123User();

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('admin');
      expect(mockUserRepository.deleteById).not.toHaveBeenCalled();
    });
  });

  describe('cleanupAdminUserAndFlush', () => {
    it('should flush all users when admin user exists', async () => {
      const adminUser = new User({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findByUsername.mockResolvedValue(adminUser);
      mockUserRepository.deleteAll.mockResolvedValue();

      await userService.cleanupAdminUserAndFlush();

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('admin');
      expect(mockUserRepository.deleteAll).toHaveBeenCalled();
    });

    it('should not flush when admin user does not exist', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      await userService.cleanupAdminUserAndFlush();

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('admin');
      expect(mockUserRepository.deleteAll).not.toHaveBeenCalled();
    });
  });

  describe('performStartupCleanup', () => {
    it('should flush all users when admin user exists', async () => {
      const adminUser = new User({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findByUsername.mockResolvedValue(adminUser);
      mockUserRepository.deleteAll.mockResolvedValue();

      await userService.performStartupCleanup();

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('admin');
      expect(mockUserRepository.deleteAll).toHaveBeenCalled();
    });

    it('should remove admin/Password123 user when admin user does not exist', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);

      await userService.performStartupCleanup();

      expect(mockUserRepository.findByUsername).toHaveBeenCalledWith('admin');
    });
  });

  describe('getAdminCount', () => {
    it('should return admin user count', async () => {
      mockUserRepository.countAdmins.mockResolvedValue(2);

      const count = await userService.getAdminCount();

      expect(count).toBe(2);
      expect(mockUserRepository.countAdmins).toHaveBeenCalled();
    });

    it('should return 0 when no admin users exist', async () => {
      mockUserRepository.countAdmins.mockResolvedValue(0);

      const count = await userService.getAdminCount();

      expect(count).toBe(0);
    });

    it('should coerce string admin COUNT from driver to number (Bug 0012)', async () => {
      mockUserRepository.countAdmins.mockResolvedValue('2');

      const count = await userService.getAdminCount();

      expect(count).toBe(2);
    });
  });

  describe('changeUserRole (Phase 26)', () => {
    function buildAdmin(id = 1) {
      return new User({ id, username: `admin${id}`, email: `admin${id}@example.com`, passwordHash: 'h', isAdmin: true, role: 'admin' });
    }
    function buildRegular(id = 2) {
      return new User({ id, username: `user${id}`, email: `user${id}@example.com`, passwordHash: 'h', isAdmin: false, role: 'user' });
    }

    test('promotes a user to office_admin when caller is admin', async () => {
      const admin = buildAdmin(1);
      const target = buildRegular(2);
      mockUserRepository.findById = jest.fn()
        .mockResolvedValueOnce(admin)   // actor lookup
        .mockResolvedValueOnce(target)  // target lookup
        .mockResolvedValueOnce(new User({ id: 2, username: 'user2', email: 'u@x', passwordHash: 'h', role: 'office_admin' }));
      mockUserRepository.executeRawQuery = jest.fn().mockResolvedValue();

      const updated = await userService.changeUserRole(2, 'office_admin', 1);

      expect(updated.role).toBe('office_admin');
      expect(mockUserRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET role = ?'),
        ['office_admin', 0, 2]
      );
    });

    test('rejects unknown role values', async () => {
      mockUserRepository.findById = jest.fn();
      await expect(userService.changeUserRole(2, 'super_admin', 1))
        .rejects.toThrow(/Invalid role/);
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    test('rejects when caller is not admin', async () => {
      mockUserRepository.findById = jest.fn().mockResolvedValueOnce(buildRegular(99));
      await expect(userService.changeUserRole(2, 'admin', 99))
        .rejects.toThrow(/Only admins can change user roles/);
    });

    test('rejects when target does not exist', async () => {
      mockUserRepository.findById = jest.fn()
        .mockResolvedValueOnce(buildAdmin(1))
        .mockResolvedValueOnce(null);
      await expect(userService.changeUserRole(999, 'admin', 1))
        .rejects.toThrow('User not found');
    });

    test('blocks demoting the last admin', async () => {
      const admin = buildAdmin(1);
      mockUserRepository.findById = jest.fn()
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(admin); // target is the same admin
      // getAdminCount delegates to userRepository.countAdmins; mock it to
      // return 1 so we trip the last-admin guard.
      mockUserRepository.countAdmins = jest.fn().mockResolvedValue(1);
      mockUserRepository.executeRawQuery = jest.fn();

      await expect(userService.changeUserRole(1, 'user', 1))
        .rejects.toThrow(/last admin/);
      expect(mockUserRepository.executeRawQuery).not.toHaveBeenCalled();
    });

    test('no-op when target already has the requested role', async () => {
      const admin = buildAdmin(1);
      const target = new User({ id: 2, username: 'oa', email: 'oa@x', passwordHash: 'h', role: 'office_admin' });
      mockUserRepository.findById = jest.fn()
        .mockResolvedValueOnce(admin)
        .mockResolvedValueOnce(target);
      mockUserRepository.executeRawQuery = jest.fn();

      const result = await userService.changeUserRole(2, 'office_admin', 1);
      expect(result).toBe(target);
      expect(mockUserRepository.executeRawQuery).not.toHaveBeenCalled();
    });
  });

  describe('deleteUser', () => {
    it('should delete a regular user successfully', async () => {
      const adminUser = new User({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      const regularUser = new User({
        id: 2,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        isAdmin: false,
        role: 'user',
      });

      mockUserRepository.findById
        .mockResolvedValueOnce(adminUser) // Deleter
        .mockResolvedValueOnce(regularUser); // User to delete
      mockUserRepository.countAdmins.mockResolvedValue(1);
      mockUserRepository.deleteById.mockResolvedValue();

      await userService.deleteUser(2, 1);

      expect(mockUserRepository.deleteById).toHaveBeenCalledWith(2);
    });

    it('should delete an admin user when multiple admins exist', async () => {
      const adminUser1 = new User({
        id: 1,
        username: 'admin1',
        email: 'admin1@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      const adminUser2 = new User({
        id: 2,
        username: 'admin2',
        email: 'admin2@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById
        .mockResolvedValueOnce(adminUser1) // Deleter
        .mockResolvedValueOnce(adminUser2); // User to delete
      mockUserRepository.countAdmins.mockResolvedValue(2);
      mockUserRepository.deleteById.mockResolvedValue();

      await userService.deleteUser(2, 1);

      expect(mockUserRepository.deleteById).toHaveBeenCalledWith(2);
    });

    it('should throw error when attempting to delete last admin user', async () => {
      // Phase 17 added self-deletion prevention which fires BEFORE the
      // last-admin guard, so this test must use distinct deleter and target
      // ids to actually exercise the last-admin path. Imagine an admin
      // (id 100) trying to delete another admin (id 1) who is the only
      // admin per the mocked count — i.e. the demote-the-last-admin case.
      const deleter = new User({
        id: 100,
        username: 'someotheradmin',
        email: 'deleter@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });
      const target = new User({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById
        .mockResolvedValueOnce(deleter) // Deleter
        .mockResolvedValueOnce(target); // User to delete
      mockUserRepository.countAdmins.mockResolvedValue(1);

      await expect(userService.deleteUser(1, 100)).rejects.toThrow('Cannot delete the last admin user');
      expect(mockUserRepository.deleteById).not.toHaveBeenCalled();
    });

    it('should throw error when deleter is not admin', async () => {
      const regularUser = new User({
        id: 1,
        username: 'user',
        email: 'user@example.com',
        passwordHash: 'hash',
        isAdmin: false,
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(regularUser);

      await expect(userService.deleteUser(2, 1)).rejects.toThrow('Only admins can delete users');
      expect(mockUserRepository.deleteById).not.toHaveBeenCalled();
    });

    it('should throw error when user to delete does not exist', async () => {
      const adminUser = new User({
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById
        .mockResolvedValueOnce(adminUser) // Deleter
        .mockResolvedValueOnce(null); // User to delete (not found)

      await expect(userService.deleteUser(999, 1)).rejects.toThrow('User not found');
      expect(mockUserRepository.deleteById).not.toHaveBeenCalled();
    });
  });

  describe('initializeDevAdminUser', () => {
    beforeEach(() => {
      // Mock process.env.NODE_ENV to be 'development'
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      delete process.env.NODE_ENV;
    });

    it('should create admin user without first_name or last_name fields (Bug 0010)', async () => {
      mockUserRepository.findByUsername.mockResolvedValue(null);
      
      const createdAdmin = new User({
        id: 9999,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hashed',
        isAdmin: true,
        role: 'admin',
      });
      
      mockUserRepository.createWithId.mockResolvedValue(createdAdmin);

      const result = await userService.initializeDevAdminUser();

      expect(result).toBeDefined();
      expect(result.username).toBe('admin');
      expect(mockUserRepository.createWithId).toHaveBeenCalled();
      
      // Verify that the User object passed to createWithId doesn't have first_name in toDatabaseFormat
      const userPassedToCreate = mockUserRepository.createWithId.mock.calls[0][0];
      const dbFormat = userPassedToCreate.toDatabaseFormat();
      expect(dbFormat).not.toHaveProperty('first_name');
      expect(dbFormat).not.toHaveProperty('last_name');
    });

    it('should return null in production mode', async () => {
      process.env.NODE_ENV = 'production';
      
      const result = await userService.initializeDevAdminUser();
      
      expect(result).toBeNull();
      expect(mockUserRepository.findByUsername).not.toHaveBeenCalled();
    });
  });
});

