/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid, false otherwise
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

module.exports = {
  isValidEmail,
};
