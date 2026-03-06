const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const { authenticate, authorize } = require('../middleware/auth');
const { generateToken } = require('../utils/token');

const userService = new UserService();

// Check if any users exist endpoint (public)
router.get('/check-users', async (req, res, next) => {
  try {
    const hasUsers = await userService.hasUsers();
    res.json({
      hasUsers: hasUsers,
    });
  } catch (error) {
    next(error);
  }
});

// Register endpoint (public - first user becomes admin)
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, first_name, last_name, office_location } = req.body;
    const logger = require('../utils/logger');

    logger.info(`Registration attempt for email: ${email}`);

    if (!email || !password) {
      return res.status(400).json({
        error: {
          message: 'Email and password are required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    // Use email as username for registration
    const user = await userService.registerUser({
      username: email,
      email,
      password,
      first_name,
      last_name,
      office_location,
    });

    const token = generateToken(user);

    logger.info(`Registration successful for email: ${email}, isAdmin: ${user.isAdmin}`);

    res.status(201).json({
      token,
      user: user.toJSON(),
      message: user.isAdmin ? 'First user registered successfully. You are now the administrator.' : 'Registration successful',
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error(`Registration failed: ${error.message}`);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'USER_EXISTS',
        },
      });
    }
    if (error.message.includes('Invalid email') || error.message.includes('Invalid office location')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
        },
      });
    }
    next(error);
  }
});

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
    const { username, email, password, first_name, last_name, office_location, is_admin, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        error: {
          message: 'Username, email, and password are required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    const user = await userService.createUser(
      { username, email, password, first_name, last_name, office_location, is_admin, role },
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
    if (error.message.includes('Only admins') || error.message.includes('Insufficient permissions')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'FORBIDDEN',
        },
      });
    }
    if (error.message.includes('Invalid email') || error.message.includes('Invalid office location')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
        },
      });
    }
    next(error);
  }
});

// Update user endpoint (admin can update any user, users can update themselves)
router.put('/users/:id', authenticate, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const { first_name, last_name, email, office_location, is_admin, role } = req.body;

    const user = await userService.updateUser(userId, {
      first_name,
      last_name,
      email,
      office_location,
      is_admin,
      role,
    }, req.user.id);

    res.json(user.toJSON());
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'USER_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('can only update your own') || error.message.includes('Only admins')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'FORBIDDEN',
        },
      });
    }
    if (error.message.includes('already exists') || error.message.includes('Invalid')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
        },
      });
    }
    next(error);
  }
});

// Get all users endpoint (admin only)
router.get('/users', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users.map(u => u.toJSON()));
  } catch (error) {
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

// Delete user endpoint (admin only)
router.delete('/users/:id', authenticate, authorize(['admin']), async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id);
    const deletedBy = req.user.id;

    if (isNaN(userId)) {
      return res.status(400).json({
        error: {
          message: 'Invalid user ID',
          code: 'INVALID_USER_ID',
        },
      });
    }

    await userService.deleteUser(userId, deletedBy);

    res.status(204).send();
  } catch (error) {
    if (error.message === 'User not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'USER_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('Only admins can delete users')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'FORBIDDEN',
        },
      });
    }
    if (error.message.includes('last admin user')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'CANNOT_DELETE_LAST_ADMIN',
        },
      });
    }
    next(error);
  }
});

// Forgot password endpoint (request password reset)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: {
          message: 'Email is required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    await userService.requestPasswordReset(email);

    // Always return success to prevent email enumeration
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  } catch (error) {
    if (error.message.includes('Valid email')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'VALIDATION_ERROR',
        },
      });
    }
    // Don't reveal errors to prevent email enumeration
    res.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });
  }
});

// Reset password endpoint (using reset token)
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        error: {
          message: 'Token and new password are required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    await userService.resetPassword(token, newPassword);

    res.json({
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    if (error.message.includes('Invalid or expired') || error.message.includes('expired')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_TOKEN',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

