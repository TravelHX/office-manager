const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');
const { authenticate, authorize, requireCompleteProfile } = require('../middleware/auth');
const { generateToken } = require('../utils/token');
const { isValidEmail } = require('../utils/email-validator');

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

// Validate invitation token for profile completion (public)
router.get('/provision/validate', async (req, res, next) => {
  try {
    const token = typeof req.query.token === 'string' ? req.query.token : '';
    const result = await userService.validateInvitationToken(token);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Complete provisioned profile: password + office location (public, token required)
router.post('/complete-profile', async (req, res, next) => {
  try {
    const { token, password, office_location } = req.body || {};
    const user = await userService.completeProfileByInvitationToken(token, password, office_location);
    const sessionToken = generateToken(user);
    res.json({
      message: 'Profile complete.',
      user: user.toJSON(),
      token: sessionToken,
    });
  } catch (error) {
    if (
      error.message.includes('required')
      || error.message.includes('Invalid')
      || error.message.includes('expired')
      || error.message.includes('already complete')
      || error.message.includes('office location')
    ) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'PROFILE_COMPLETION_FAILED',
        },
      });
    }
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

    const result = await userService.performLogin(username, password);

    if (result.type === 'unknown_user') {
      return res.status(401).json({
        error: {
          message:
            'No account exists for this email. An administrator must create your account before you can sign in.',
          code: 'UNKNOWN_USER',
        },
      });
    }

    if (result.type === 'needs_setup') {
      return res.status(403).json({
        error: {
          message:
            'Finish setting up your account by choosing a password and office location on the next page.',
          code: 'PROFILE_SETUP_REQUIRED',
          profileSetupUrl: result.profileSetupUrl,
        },
      });
    }

    if (result.type === 'setup_expired') {
      return res.status(403).json({
        error: {
          message:
            'Your account setup window has expired. Ask your administrator to reset your access or provision you again.',
          code: 'PROFILE_SETUP_EXPIRED',
        },
      });
    }

    if (result.type === 'invalid_credentials') {
      return res.status(401).json({
        error: {
          message: 'Invalid username or password',
          code: 'INVALID_CREDENTIALS',
        },
      });
    }

    const token = generateToken(result.user);
    logger.info(`Login successful for username: ${username}`);

    res.json({
      token,
      user: result.user.toJSON(),
    });
  } catch (error) {
    const logger = require('../utils/logger');
    logger.error(`Login failed: ${error.message}`);
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

// Create user endpoint (admin only) — email + name only; user completes profile after login or via optional setup URL
router.post('/users', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
  try {
    const { name, email, first_name, last_name, is_admin, role } = req.body || {};

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        error: {
          message: 'Email and name are required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    const hasName = name !== undefined && name !== null && String(name).trim() !== '';
    const hasSplitName = (first_name && String(first_name).trim()) || (last_name && String(last_name).trim());
    if (!hasName && !hasSplitName) {
      return res.status(400).json({
        error: {
          message: 'Email and name are required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    const { user, invitationToken } = await userService.createUser(
      { name, email, first_name, last_name, is_admin, role },
      req.user.id
    );

    const tokenEnc = encodeURIComponent(invitationToken);
    res.status(201).json({
      ...user.toJSON(),
      invitationToken,
      profileSetupUrl: `/pages/complete-profile.html?token=${tokenEnc}`,
    });
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
    if (error.message.includes('Admin user creation accepts only')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_CREATE_PAYLOAD',
        },
      });
    }
    if (error.message.includes('Invalid email') || error.message.includes('Invalid office location') || error.message.includes('Name is required')) {
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
router.get('/users', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
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
router.delete('/users/:id', authenticate, requireCompleteProfile, authorize(['admin']), async (req, res, next) => {
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

// Forgot password: no outbound email; instruct user to contact an admin
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !String(email).trim()) {
      return res.status(400).json({
        error: {
          message: 'Email is required',
          code: 'MISSING_FIELDS',
        },
      });
    }

    if (!isValidEmail(String(email).trim())) {
      return res.status(400).json({
        error: {
          message: 'Invalid email format',
          code: 'VALIDATION_ERROR',
        },
      });
    }

    res.json({
      message:
        'This application does not send email. Ask your administrator to reset your password from User Management. They can give you a reset link or set you up again.',
      code: 'NO_EMAIL_PASSWORD_RESET',
    });
  } catch (error) {
    next(error);
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

