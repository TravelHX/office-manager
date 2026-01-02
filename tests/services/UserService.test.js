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
});

