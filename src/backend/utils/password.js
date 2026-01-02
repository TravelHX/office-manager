const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

/**
 * Hash a plain text password
 * @param {string} plainPassword - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(plainPassword) {
  if (!plainPassword || plainPassword.trim() === '') {
    throw new Error('Password cannot be empty');
  }
  return await bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Verify a plain text password against a hash
 * @param {string} plainPassword - Plain text password to verify
 * @param {string} hash - Hashed password to compare against
 * @returns {Promise<boolean>} True if password matches, false otherwise
 */
async function verifyPassword(plainPassword, hash) {
  if (!plainPassword || !hash) {
    return false;
  }
  return await bcrypt.compare(plainPassword, hash);
}

module.exports = {
  hashPassword,
  verifyPassword,
};

