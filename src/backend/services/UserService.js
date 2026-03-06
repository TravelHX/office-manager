const UserRepository = require('../repositories/UserRepository');
const User = require('../models/User');
const { hashPassword, verifyPassword } = require('../utils/password');
const { isValidEmail } = require('../utils/email-validator');
const { isValidOfficeLocation } = require('../utils/office-location');
const { generateResetToken, calculateTokenExpiry, isTokenExpired } = require('../utils/reset-token');
const fs = require('fs');
const path = require('path');

class UserService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Create a new user (admin only)
   * @param {Object} userData - User data (username, email, password, first_name, last_name, office_location, is_admin, role)
   * @param {number} createdBy - ID of user creating this user (must be admin)
   * @returns {Promise<User>} Created user
   */
  async createUser(userData, createdBy) {
    // Validate required fields
    if (!userData.username || !userData.email || !userData.password) {
      throw new Error('Username, email, and password are required');
    }

    // Validate email format
    if (!isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate office location if provided
    if (userData.office_location && !isValidOfficeLocation(userData.office_location)) {
      throw new Error(`Invalid office location. Must be one of: ${require('../utils/office-location').getAllOfficeLocations().join(', ')}`);
    }

    // Check if creator is admin
    const creator = await this.userRepository.findById(createdBy);
    if (!creator || !creator.isAdmin) {
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

    // Determine role and isAdmin
    const isAdmin = userData.is_admin === true || userData.is_admin === 'true' || userData.role === 'admin';
    const role = userData.role || (isAdmin ? 'admin' : 'user');

    // Create user
    const user = new User({
      username: userData.username,
      first_name: userData.first_name || userData.firstName || null,
      last_name: userData.last_name || userData.lastName || null,
      email: userData.email,
      office_location: userData.office_location || userData.officeLocation || null,
      password_hash: passwordHash,
      is_admin: isAdmin,
      role: role,
    });

    return await this.userRepository.create(user);
  }

  /**
   * Update user profile (admin can update any user, users can update themselves)
   * @param {number} userId - User ID to update
   * @param {Object} updates - Fields to update
   * @param {number} updatedBy - ID of user making the update
   * @returns {Promise<User>} Updated user
   */
  async updateUser(userId, updates, updatedBy) {
    const updater = await this.userRepository.findById(updatedBy);
    if (!updater) {
      throw new Error('Updater not found');
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Users can only update themselves unless they're admin
    const isAdmin = updater.isAdmin || updater.role === 'admin';
    if (!isAdmin && userId !== updatedBy) {
      throw new Error('You can only update your own profile');
    }

    // Validate email format if being updated
    if (updates.email && !isValidEmail(updates.email)) {
      throw new Error('Invalid email format');
    }

    // Validate office location if being updated
    if (updates.office_location && !isValidOfficeLocation(updates.office_location)) {
      throw new Error(`Invalid office location. Must be one of: ${require('../utils/office-location').getAllOfficeLocations().join(', ')}`);
    }

    // Check email uniqueness if email is being changed
    if (updates.email && updates.email !== user.email) {
      const existingUserByEmail = await this.userRepository.findByEmail(updates.email);
      if (existingUserByEmail) {
        throw new Error('Email already exists');
      }
    }

    // Only admins can change is_admin flag
    if (updates.is_admin !== undefined && !isAdmin) {
      throw new Error('Only admins can change admin status');
    }

    // Update role if is_admin is being set
    if (updates.is_admin === true || updates.is_admin === 'true') {
      updates.role = 'admin';
    } else if (updates.is_admin === false || updates.is_admin === 'false') {
      updates.role = updates.role || 'user';
    }

    // Map camelCase to snake_case for database
    const dbUpdates = {};
    if (updates.first_name !== undefined || updates.firstName !== undefined) {
      dbUpdates.first_name = updates.first_name || updates.firstName;
    }
    if (updates.last_name !== undefined || updates.lastName !== undefined) {
      dbUpdates.last_name = updates.last_name || updates.lastName;
    }
    if (updates.email !== undefined) {
      dbUpdates.email = updates.email;
    }
    if (updates.office_location !== undefined || updates.officeLocation !== undefined) {
      dbUpdates.office_location = updates.office_location || updates.officeLocation;
    }
    if (updates.is_admin !== undefined) {
      dbUpdates.is_admin = updates.is_admin === true || updates.is_admin === 'true';
    }
    if (updates.role !== undefined) {
      dbUpdates.role = updates.role;
    }

    return await this.userRepository.update(userId, dbUpdates);
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
      
      // Update role, isAdmin, username, and email if needed
      const updates = {};
      if (!adminUser.isAdmin) {
        updates.is_admin = true;
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
        is_admin: true,
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
            await this.userRepository.update(adminUser.id, { is_admin: true, role: 'admin', email });
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
      // Ensure isAdmin flag and role are set
      if (!adminUser.isAdmin || adminUser.role !== 'admin') {
        await this.userRepository.update(adminUser.id, { is_admin: true, role: 'admin' });
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
        is_admin: true,
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

  /**
   * Request password reset (generates reset token and sends email)
   * @param {string} email - User email address
   * @returns {Promise<void>}
   */
  async requestPasswordReset(email) {
    if (!email || !isValidEmail(email)) {
      throw new Error('Valid email address is required');
    }

    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists or not for security
      return;
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetTokenExpiry = calculateTokenExpiry(1); // 1 hour expiry

    // Store reset token in database
    await this.userRepository.update(user.id, {
      reset_token: resetToken,
      reset_token_expiry: resetTokenExpiry,
    });

    // TODO: Send email with reset link
    // For now, we'll just log it (in production, implement email sending)
    const logger = require('../utils/logger');
    logger.info(`Password reset requested for ${email}. Token: ${resetToken}`);
    
    // In a real implementation, you would send an email here:
    // await sendPasswordResetEmail(user.email, resetToken);
  }

  /**
   * Reset password using reset token
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<User>} Updated user
   */
  async resetPassword(token, newPassword) {
    if (!token || !newPassword) {
      throw new Error('Token and new password are required');
    }

    // Find user by reset token
    const user = await this.userRepository.findByResetToken(token);
    if (!user) {
      throw new Error('Invalid or expired reset token');
    }

    // Check if token has expired
    if (isTokenExpired(user.resetTokenExpiry)) {
      throw new Error('Reset token has expired');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and clear reset token
    await this.userRepository.updatePassword(user.id, passwordHash);
    await this.userRepository.update(user.id, {
      reset_token: null,
      reset_token_expiry: null,
    });

    return await this.userRepository.findById(user.id);
  }

  /**
   * Get total count of users in the system
   * @returns {Promise<number>} Total user count
   */
  async getUserCount() {
    return await this.userRepository.count();
  }

  /**
   * Get count of admin users in the system
   * @returns {Promise<number>} Admin user count
   */
  async getAdminCount() {
    return await this.userRepository.countAdmins();
  }

  /**
   * Check if any users exist in the system
   * @returns {Promise<boolean>} True if users exist, false otherwise
   */
  async hasUsers() {
    const count = await this.getUserCount();
    return count > 0;
  }

  /**
   * Delete a user (admin only)
   * Prevents deletion if it would leave zero admin users
   * Associated data (bookings, reservations, overtime) is automatically deleted via CASCADE
   * @param {number} userId - User ID to delete
   * @param {number} deletedBy - ID of admin performing the deletion
   * @returns {Promise<void>}
   */
  async deleteUser(userId, deletedBy) {
    // Check if deleter is admin
    const deleter = await this.userRepository.findById(deletedBy);
    if (!deleter || !deleter.isAdmin) {
      throw new Error('Only admins can delete users');
    }

    // Check if user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is an admin
    if (user.isAdmin) {
      // Count total admin users
      const adminCount = await this.getAdminCount();
      
      // Prevent deletion if this is the last admin
      if (adminCount <= 1) {
        throw new Error('Cannot delete the last admin user. There must always be at least one admin user in the system.');
      }
    }

    // Delete user (cascade will handle associated data automatically)
    await this.userRepository.deleteById(userId);
  }

  /**
   * Startup cleanup: Remove admin/password123 user if it exists
   * This removes the default test admin user created during development
   * @returns {Promise<void>}
   */
  async cleanupAdminPassword123User() {
    const logger = require('../utils/logger');
    
    try {
      const adminUser = await this.userRepository.findByUsername('admin');
      if (adminUser) {
        // Verify password is Password123
        const isValid = await verifyPassword('Password123', adminUser.passwordHash);
        if (isValid) {
          logger.info('Removing admin/Password123 test user during startup cleanup');
          await this.userRepository.deleteById(adminUser.id);
          logger.info(`Removed admin user with ID: ${adminUser.id}`);
        }
      }
    } catch (error) {
      logger.warn('Error during admin/Password123 user cleanup:', error.message);
    }
  }

  /**
   * Startup cleanup: Check if "admin" user exists and flush all users if found
   * This ensures a clean slate when admin user exists (indicates test/dev environment)
   * @returns {Promise<void>}
   */
  async cleanupAdminUserAndFlush() {
    const logger = require('../utils/logger');
    
    try {
      const adminUser = await this.userRepository.findByUsername('admin');
      if (adminUser) {
        logger.info('Admin user found during startup cleanup - flushing all users');
        await this.userRepository.deleteAll();
        logger.info('All users flushed successfully');
      }
    } catch (error) {
      logger.warn('Error during admin user flush cleanup:', error.message);
    }
  }

  /**
   * Perform startup cleanup operations atomically
   * 1. Remove admin/password123 user if it exists
   * 2. If admin user exists, flush all users
   * @returns {Promise<void>}
   */
  async performStartupCleanup() {
    const logger = require('../utils/logger');
    logger.info('Starting user cleanup operations...');

    try {
      // First, check if admin user exists
      const adminUser = await this.userRepository.findByUsername('admin');
      
      if (adminUser) {
        // If admin user exists, flush all users (atomic operation)
        logger.info('Admin user detected - flushing all users');
        await this.userRepository.deleteAll();
        logger.info('Startup cleanup complete: All users flushed');
      } else {
        // If no admin user, just remove admin/password123 user if it exists
        await this.cleanupAdminPassword123User();
        logger.info('Startup cleanup complete: Admin/Password123 user removed if present');
      }
    } catch (error) {
      logger.error('Error during startup cleanup:', error.message);
      throw error;
    }
  }

  /**
   * Register a new user (public registration)
   * First user automatically becomes admin
   * @param {Object} userData - User data (username, email, password, first_name, last_name, office_location)
   * @returns {Promise<User>} Created user
   */
  async registerUser(userData) {
    // Validate required fields
    if (!userData.email || !userData.password) {
      throw new Error('Email and password are required');
    }
    
    // Use email as username if username not provided
    if (!userData.username) {
      userData.username = userData.email;
    }

    // Validate email format
    if (!isValidEmail(userData.email)) {
      throw new Error('Invalid email format');
    }

    // Validate office location if provided
    if (userData.office_location && !isValidOfficeLocation(userData.office_location)) {
      throw new Error(`Invalid office location. Must be one of: ${require('../utils/office-location').getAllOfficeLocations().join(', ')}`);
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

    // Check if this is the first user
    const userCount = await this.getUserCount();
    const isFirstUser = userCount === 0;

    // Hash password
    const passwordHash = await hashPassword(userData.password);

    // First user automatically becomes admin
    const isAdmin = isFirstUser;
    const role = isFirstUser ? 'admin' : 'user';

    // Create user
    const user = new User({
      username: userData.username,
      first_name: userData.first_name || userData.firstName || null,
      last_name: userData.last_name || userData.lastName || null,
      email: userData.email,
      office_location: userData.office_location || userData.officeLocation || null,
      password_hash: passwordHash,
      is_admin: isAdmin,
      role: role,
    });

    const createdUser = await this.userRepository.create(user);
    
    const logger = require('../utils/logger');
    if (isFirstUser) {
      logger.info(`First user registered and automatically assigned admin role: ${createdUser.username}`);
    }

    return createdUser;
  }
}

module.exports = UserService;

