const UserService = require('../../src/backend/services/UserService');
const UserRepository = require('../../src/backend/repositories/UserRepository');
const User = require('../../src/backend/models/User');
const { hashPassword, verifyPassword } = require('../../src/backend/utils/password');

// Mock the UserRepository
jest.mock('../../src/backend/repositories/UserRepository');

describe('UserService', () => {
  let userService;
  let mockUserRepository;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
      findByUsername: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      createWithId: jest.fn(),
      update: jest.fn(),
      updatePassword: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
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

  describe('createUser', () => {
    it('should create a new user when admin creates it', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(new User({
        id: 1,
        username: 'newuser',
        email: 'newuser@example.com',
        passwordHash: 'hashed',
        role: 'user',
      }));

      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
        role: 'user',
      };

      const result = await userService.createUser(userData, 1000);

      expect(result).toBeDefined();
      expect(result.username).toBe('newuser');
      expect(mockUserRepository.create).toHaveBeenCalled();
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

      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      await expect(userService.createUser(userData, 1)).rejects.toThrow('Only admins can create users');
    });

    it('should throw error if username already exists', async () => {
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
        username: 'existing',
        email: 'existing@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(existingUser);

      const userData = {
        username: 'existing',
        email: 'newuser@example.com',
        password: 'password123',
      };

      await expect(userService.createUser(userData, 1000)).rejects.toThrow('Username already exists');
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
        username: 'existing',
        email: 'existing@example.com',
        passwordHash: 'hash',
        role: 'user',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'password123',
      };

      await expect(userService.createUser(userData, 1000)).rejects.toThrow('Email already exists');
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

  describe('createUser with profile fields', () => {
    it('should create user with first name, last name, email, and office location', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(new User({
        id: 1,
        username: 'newuser',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        officeLocation: 'London',
        passwordHash: 'hashed',
        isAdmin: false,
        role: 'user',
      }));

      const userData = {
        username: 'newuser',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        office_location: 'London',
        password: 'password123',
      };

      const result = await userService.createUser(userData, 1000);

      expect(result).toBeDefined();
      expect(result.username).toBe('newuser');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should throw error for invalid email format', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById.mockResolvedValue(creator);

      const userData = {
        username: 'newuser',
        email: 'invalid-email',
        password: 'password123',
      };

      await expect(userService.createUser(userData, 1000)).rejects.toThrow('Invalid email format');
    });

    it('should throw error for invalid office location', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);

      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        office_location: 'New York',
        password: 'password123',
      };

      await expect(userService.createUser(userData, 1000)).rejects.toThrow('Invalid office location');
    });

    it('should set isAdmin flag when is_admin is true', async () => {
      const creator = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@example.com',
        passwordHash: 'hash',
        isAdmin: true,
        role: 'admin',
      });

      mockUserRepository.findById.mockResolvedValue(creator);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(new User({
        id: 1,
        username: 'newadmin',
        email: 'newadmin@example.com',
        passwordHash: 'hashed',
        isAdmin: true,
        role: 'admin',
      }));

      const userData = {
        username: 'newadmin',
        email: 'newadmin@example.com',
        password: 'password123',
        is_admin: true,
      };

      const result = await userService.createUser(userData, 1000);

      expect(result).toBeDefined();
      expect(mockUserRepository.create).toHaveBeenCalled();
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

    it('should register subsequent users as regular users', async () => {
      mockUserRepository.count.mockResolvedValue(1);
      mockUserRepository.findByUsername.mockResolvedValue(null);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      
      const newUser = new User({
        id: 2,
        username: 'seconduser',
        email: 'seconduser@example.com',
        passwordHash: 'hashed',
        isAdmin: false,
        role: 'user',
      });
      mockUserRepository.create.mockResolvedValue(newUser);

      const userData = {
        username: 'seconduser',
        email: 'seconduser@example.com',
        password: 'password123',
      };

      const result = await userService.registerUser(userData);

      expect(result).toBeDefined();
      expect(result.isAdmin).toBe(false);
      expect(result.role).toBe('user');
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
});

