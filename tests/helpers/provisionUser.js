const UserService = require('../../src/backend/services/UserService');

/**
 * Create an admin-provisioned user and complete their profile (password + office).
 * Use in integration tests that need a fully active user after Phase 19.
 *
 * @param {number} adminUserId
 * @param {Object} opts
 * @param {string} opts.email
 * @param {string} [opts.name]
 * @param {string} [opts.password]
 * @param {string} [opts.office_location]
 * @param {boolean} [opts.is_admin]
 * @param {string} [opts.role]
 * @returns {Promise<import('../../src/backend/models/User')>}
 */
async function createProvisionedUserWithPassword(adminUserId, opts) {
  const {
    email,
    name = 'Test User',
    password = 'Test123!',
    office_location = 'London',
    is_admin = false,
    role,
  } = opts;

  const userService = new UserService();
  const { user, invitationToken } = await userService.createUser(
    {
      email,
      name,
      is_admin,
      role: role !== undefined ? role : (is_admin ? 'admin' : 'user'),
    },
    adminUserId
  );
  await userService.completeProfileByInvitationToken(invitationToken, password, office_location);
  return userService.getUserById(user.id);
}

module.exports = { createProvisionedUserWithPassword };
