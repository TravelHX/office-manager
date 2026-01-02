const UserRepository = require('../repositories/UserRepository');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const fs = require('fs');
const path = require('path');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Create a new user (admin only)
   * @param {Object} userData - User data (username, email, password, role)
   * @param {number} createdBy - ID of user creating this user (must be admin)
   * @returns {Promise<User>} Created user
   */
  async createUser(userData, createdBy) {
    // Validate required fields
    if (!userData.username || !userData.email || !userData.password) {
      throw new Error('Username, email, and password are required');
    }

    // Check if creator is admin
    const creator = await this.userRepository.findById(createdBy);
    if (!creator || creator.role !== 'admin') {
      throw new Error('Only admins can create users');
    }

    // Check if username already exists
    const existingUserByUsername = await this.userRepository.findByUsername(userData.username);
    if (existingUserByUsername) {
      throw new Error('Username already exists');
    }

    // Check if email already exists
    const existingUserByEmail = await this.userRepository.findByEmail(userData.email);
    if (existingUserByEmail) {
      throw new Error('Email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(userData.password);

    // Create user
    const user = new User({
      username: userData.username,
      email: userData.email,
      password_hash: passwordHash,
      role: userData.role || 'user',
    });

    return await this.userRepository.create(user);
  }

  /**
   * Change user password
   * @param {number} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<User>} Updated user
   */
  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error('Current password and new password are required');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Current password is incorrect');
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    return await this.userRepository.updatePassword(userId, newPasswordHash);
  }

  /**
   * Authenticate user with username and password
   * @param {string} username - Username
   * @param {string} password - Plain text password
   * @returns {Promise<User>} Authenticated user
   */
  async authenticate(username, password) {
    const logger = require('../utils/logger');
    
    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    logger.info(`Authenticating user: ${username}`);
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      logger.warn(`User not found: ${username}`);
      throw new Error('Invalid username or password');
    }

    logger.info(`User found: ${user.username} (ID: ${user.id}), verifying password...`);
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      logger.warn(`Password verification failed for user: ${username}`);
      throw new Error('Invalid username or password');
    }

    logger.info(`Authentication successful for user: ${username}`);
    return user;
  }

  /**
   * Get user by ID
   * @param {number} id - User ID
   * @returns {Promise<User>} User
   */
  async getUserById(id) {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Get user by username
   * @param {string} username - Username
   * @returns {Promise<User>} User
   */
  async getUserByUsername(username) {
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  /**
   * Get all users (admin only)
   * @returns {Promise<Array<User>>} List of users
   */
  async getAllUsers() {
    return await this.userRepository.findAll();
  }

  /**
   * Initialize admin user from config.json
   * In development mode, always uses Password123 as password
   * @returns {Promise<User>} Admin user
   */
  async initializeAdminFromConfig() {
    // Resolve path from project root: go up from services/ -> backend/ -> src/ -> project root -> data/
    const configPath = path.resolve(__dirname, '../../../data/config.json');
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`config.json not found in data/ folder at ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const adminConfig = config.admin;

    if (!adminConfig || !adminConfig.userId) {
      throw new Error('Admin configuration not found in config.json');
    }

    const userId = adminConfig.userId;
    // In development mode, always use Password123 for admin user
    const password = (process.env.NODE_ENV !== 'production') ? 'Password123' : (adminConfig.password || 'admin123');
    const username = adminConfig.username || `admin_${userId}`;
    const email = adminConfig.email || `admin_${userId}@example.com`;

    // Check if admin user already exists (by ID or username)
    let adminUser = await this.userRepository.findById(userId);
    if (!adminUser && username) {
      adminUser = await this.userRepository.findByUsername(username);
    }
    
    if (adminUser) {
      // User exists - update to ensure correct password and role
      const passwordHash = await hashPassword(password);
      await this.userRepository.updatePassword(adminUser.id, passwordHash);
      
      // Update role, username, and email if needed
      const updates = {};
      if (adminUser.role !== 'admin') {
        updates.role = 'admin';
      }
      if (adminUser.username !== username) {
        updates.username = username;
      }
      if (adminUser.email !== email) {
        updates.email = email;
      }
      
      if (Object.keys(updates).length > 0) {
        await this.userRepository.update(adminUser.id, updates);
      }
      
      adminUser = await this.userRepository.findById(adminUser.id);
    } else {
      // User doesn't exist - create it
      const passwordHash = await hashPassword(password);
      adminUser = new User({
        id: userId,
        username: username,
        email: email,
        password_hash: passwordHash,
        role: 'admin',
      });
      
      try {
        adminUser = await this.userRepository.createWithId(adminUser);
      } catch (error) {
        // If creation fails due to duplicate, try to find and update instead
        if (error.message.includes('already exists')) {
          adminUser = await this.userRepository.findByUsername(username);
          if (adminUser) {
            const passwordHash = await hashPassword(password);
            await this.userRepository.updatePassword(adminUser.id, passwordHash);
            await this.userRepository.update(adminUser.id, { role: 'admin', email });
            adminUser = await this.userRepository.findById(adminUser.id);
          } else {
            throw error;
          }
        } else {
          throw error;
        }
      }
    }

    return adminUser;
  }

  /**
   * Initialize development admin user (admin / Password123)
   * Only runs in development mode
   * Creates/updates admin user with username "admin" and password "Password123"
   * @returns {Promise<User>} Admin user
   */
  async initializeDevAdminUser() {
    if (process.env.NODE_ENV === 'production') {
      return null; // Skip in production
    }

    const username = 'admin';
    const password = 'Password123';
    const email = 'admin@example.com';

    // Check if admin user with this username already exists
    let adminUser = await this.userRepository.findByUsername(username);
    
    if (adminUser) {
      // Update password to ensure it's Password123
      const passwordHash = await hashPassword(password);
      adminUser = await this.userRepository.updatePassword(adminUser.id, passwordHash);
      // Ensure role is admin
      if (adminUser.role !== 'admin') {
        await this.userRepository.update(adminUser.id, { role: 'admin' });
        adminUser = await this.userRepository.findById(adminUser.id);
      }
    } else {
      // Create admin user
      // Use a high ID to avoid conflicts (e.g., 9999)
      const userId = 9999;
      const passwordHash = await hashPassword(password);
      adminUser = new User({
        id: userId,
        username: username,
        email: email,
        password_hash: passwordHash,
        role: 'admin',
      });
      adminUser = await this.userRepository.createWithId(adminUser);
    }

    return adminUser;
  }

  /**
   * Initialize development test user (0001 / Password123)
   * Only runs in development mode
   * @returns {Promise<User>} Test user
   */
  async initializeDevTestUser() {
    if (process.env.NODE_ENV === 'production') {
      return null; // Skip in production
    }

    const userId = 1;
    const username = '0001';
    const password = 'Password123';
    const email = 'test@example.com';

    // Check if test user already exists
    let testUser = await this.userRepository.findById(userId);
    
    if (testUser) {
      // Update password to ensure it's correct
      const passwordHash = await hashPassword(password);
      testUser = await this.userRepository.updatePassword(userId, passwordHash);
    } else {
      // Create test user with specific ID
      const passwordHash = await hashPassword(password);
      testUser = new User({
        id: userId,
        username: username,
        email: email,
        password_hash: passwordHash,
        role: 'user',
      });
      testUser = await this.userRepository.createWithId(testUser);
    }

    return testUser;
  }
}

module.exports = UserService;

