const crypto = require('crypto');

/**
 * Generate a secure random token for password reset
 * @returns {string} Random token string
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate expiry time for reset token (default: 1 hour from now)
 * @param {number} hours - Number of hours until expiry (default: 1)
 * @returns {Date} Expiry date
 */
function calculateTokenExpiry(hours = 1) {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

/**
 * Check if a reset token has expired
 * @param {Date|string} expiryDate - Token expiry date
 * @returns {boolean} True if token has expired, false otherwise
 */
function isTokenExpired(expiryDate) {
  if (!expiryDate) {
    return true;
  }
  const expiry = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  return expiry < new Date();
}

module.exports = {
  generateResetToken,
  calculateTokenExpiry,
  isTokenExpired,
};
