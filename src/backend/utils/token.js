const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

/**
 * Generate a JWT token for a user
 * @param {Object} user - User object with id, username, role
 * @returns {string} JWT token
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

module.exports = {
  generateToken,
  verifyToken,
};

