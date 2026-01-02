const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const { authenticate, authorize } = require('../middleware/auth');
const { generateToken } = require('../utils/token');

const userService = new UserService();

// Login endpoint
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const logger = require('../utils/logger');

    logger.info(`Login attempt for username: ${username}`);

    if (!username || !password) {
      return res.status(400).json({
        error: {
          message: 'Username and password are required',
          code: 'MISSING_CREDENTIALS',
        },
      });
    }

    const user = await userService.authenticate(username, password);
    const token = generateToken(user);

    logger.info(`Login successful for username: ${username}`);

    res.json({
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error(`Login failed: ${error.message}`);
    
    if (error.message.includes('Invalid username or password')) {
      return res.status(401).json({
        error: {
          message: error.message,
          code: 'INVALID_CREDENTIALS',
        },
      });
    }
    next(error);
  }
});

// Logout endpoint (client-side token removal, but we can track sessions if needed)
router.post('/logout', authenticate, async (req, res) => {
  // In a stateless JWT system, logout is handled client-side by removing the token
  // If we need server-side session invalidation, we'd need a token blacklist
  res.json({
    message: 'Logged out successfully',
  });
});

// Get current user endpoint
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    res.json(user.toJSON());
  } catch (error) {
    next(error);
  }
});

// Create user endpoint (admin only)
router.post('/users', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: {
          message: 'Username, email, and password are required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    const user = await userService.createUser(
      { username, email, password, role },
      req.user.id
    );

    res.status(201).json(user.toJSON());
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'USER_EXISTS',
        },
      });
    }
    if (error.message.includes('Only admins')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'FORBIDDEN',
        },
      });
    }
    next(error);
  }
});

// Change password endpoint
router.put('/users/password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Current password and new password are required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    await userService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    res.json({
      message: 'Password changed successfully',
    });
  } catch (error) {
    if (error.message.includes('incorrect') || error.message.includes('not found')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_PASSWORD',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

