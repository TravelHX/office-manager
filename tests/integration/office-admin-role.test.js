// Phase 26 integration tests for the Office Administrator role.
//
// Verifies end-to-end against the real test database:
//   - Administrator can promote a regular User to Office Administrator
//     and demote them back, emitting USER_ROLE_CHANGED with `actor_role`.
//   - Office Administrator can cancel another user's desk booking and
//     parking reservation. Audit row records `actor_role: 'office_admin'`.
//   - Office Administrator is BLOCKED (403 FORBIDDEN) from User Management
//     endpoints (POST /api/auth/users, DELETE /api/auth/users/:id, the
//     PUT /api/auth/users/:id/role role-assignment endpoint itself).
//   - Last-admin invariant still blocks demoting the only remaining
//     admin, even though we now support a third role.

const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

async function getLatestEventByType(actionType) {
  const rows = await executeQuery(
    'SELECT * FROM audit_events WHERE action_type = ? ORDER BY id DESC LIMIT 1',
    [actionType]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    ...row,
    payload: typeof row.payload === 'string' && row.payload ? JSON.parse(row.payload) : row.payload,
  };
}

describe('Office Administrator role (Phase 26)', () => {
  let userService;
  let adminUser;
  let adminToken;
  let secondAdmin;
  let secondAdminToken;
  let regularUser;
  let regularToken;
  let deskId;
  let spaceId;

  beforeAll(async () => {
    userService = new UserService();

    try {
      adminUser = await userService.getUserByUsername('admin');
    } catch (_) {
      const hashPassword = require('../../src/backend/utils/password').hashPassword;
      const User = require('../../src/backend/models/User');
      const UserRepository = require('../../src/backend/repositories/UserRepository');
      const userRepo = new UserRepository();
      const hash = await hashPassword('Password123');
      adminUser = new User({
        id: 1000,
        username: 'admin',
        email: 'admin@test.com',
        password_hash: hash,
        is_admin: true,
        role: 'admin',
        profile_complete: true,
      });
      adminUser = await userRepo.createWithId(adminUser);
    }
    adminToken = generateToken(adminUser);

    // Second admin so the last-admin invariant doesn't block role changes
    // we want to actually run during the test.
    try {
      secondAdmin = await userService.getUserByUsername('phase26secondadmin@test.com');
    } catch (_) {
      secondAdmin = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'phase26secondadmin@test.com',
        name: 'Second Admin',
        password: 'Password123',
        is_admin: true,
        role: 'admin',
      });
    }
    secondAdminToken = generateToken(secondAdmin);

    try {
      regularUser = await userService.getUserByUsername('phase26roletarget@test.com');
    } catch (_) {
      regularUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'phase26roletarget@test.com',
        name: 'Phase 26 Role Target',
        password: 'Password123',
      });
    }
    regularToken = generateToken(regularUser);

    // Pick a desk + parking space we can use without colliding with other suites.
    const deskRows = await executeQuery('SELECT id FROM desks WHERE is_active = TRUE LIMIT 1');
    if (deskRows.length > 0) {
      deskId = deskRows[0].id;
    } else {
      const r = await executeQuery(
        "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('PHASE26-DESK', 'Test', 'Phase 26 test desk', TRUE)"
      );
      deskId = r.insertId;
    }
    const spaceRows = await executeQuery('SELECT id FROM parking_spaces WHERE is_active = TRUE LIMIT 1');
    if (spaceRows.length > 0) {
      spaceId = spaceRows[0].id;
    } else {
      const r = await executeQuery(
        "INSERT INTO parking_spaces (space_number, location, description, is_active) VALUES ('PHASE26-SPACE', 'Test', 'Phase 26 test space', TRUE)"
      );
      spaceId = r.insertId;
    }
  });

  beforeEach(async () => {
    // Reset the role-target user back to plain 'user' so each test starts
    // from a known state. Idempotent.
    await executeQuery(
      "UPDATE users SET role = 'user', is_admin = 0 WHERE id = ?",
      [regularUser.id]
    );
    await executeQuery('DELETE FROM audit_events');
  });

  describe('PUT /api/auth/users/:id/role', () => {
    test('admin can promote a user to office_admin; audit records actor_role and new_role', async () => {
      const res = await request(app)
        .put(`/api/auth/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'office_admin' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('office_admin');
      expect(res.body.isAdmin).toBe(false);

      const event = await getLatestEventByType('USER_ROLE_CHANGED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(adminUser.id);
      expect(event.target_id).toBe(regularUser.id);
      expect(event.payload.new_role).toBe('office_admin');
      expect(event.payload.actor_role).toBe('admin');
    });

    test('admin can demote an office_admin back to user', async () => {
      // Promote first.
      await request(app)
        .put(`/api/auth/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'office_admin' });

      const res = await request(app)
        .put(`/api/auth/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('user');
    });

    test('rejects unknown role with 400 INVALID_ROLE', async () => {
      const res = await request(app)
        .put(`/api/auth/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'super_user' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_ROLE');
    });

    test('rejects with 403 when caller is office_admin (not full admin)', async () => {
      // Promote regularUser to office_admin via direct SQL so we can see the
      // role-change endpoint reject them as caller.
      await executeQuery("UPDATE users SET role = 'office_admin', is_admin = 0 WHERE id = ?", [regularUser.id]);
      const oaToken = generateToken({ ...regularUser, role: 'office_admin', isAdmin: false });

      const res = await request(app)
        .put(`/api/auth/users/${regularUser.id}/role`)
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ role: 'admin' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('rejects with 404 when target user does not exist', async () => {
      const res = await request(app)
        .put('/api/auth/users/9999999/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'user' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('Office Administrator capabilities (26.6 / 26.7)', () => {
    let oaToken;

    beforeEach(async () => {
      // Make regularUser an office_admin for these tests.
      await executeQuery("UPDATE users SET role = 'office_admin', is_admin = 0 WHERE id = ?", [regularUser.id]);
      oaToken = generateToken({ ...regularUser, role: 'office_admin', isAdmin: false });
    });

    test('office_admin can cancel another user\'s desk booking', async () => {
      // Seed a booking owned by adminUser so OA must cancel-on-behalf.
      const create = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deskId, startDate: '2099-10-10', endDate: '2099-10-10' });
      expect(create.status).toBe(201);

      const cancel = await request(app)
        .delete(`/api/admin/bookings/${create.body.id}`)
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ reason: 'phase 26 OA test' });
      expect(cancel.status).toBe(204);

      const event = await getLatestEventByType('DESK_BOOKING_CANCELLED_BY_ADMIN');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
      expect(event.payload.actor_role).toBe('office_admin');
    });

    test('office_admin can cancel another user\'s parking reservation', async () => {
      const create = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ parkingSpaceId: spaceId, reservationDate: '2099-10-11', timePeriod: 'full_day' });
      expect(create.status).toBe(201);

      const cancel = await request(app)
        .delete(`/api/admin/parking-reservations/${create.body.id}`)
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ reason: 'phase 26 OA test' });
      expect(cancel.status).toBe(204);

      const event = await getLatestEventByType('PARKING_RESERVATION_CANCELLED_BY_ADMIN');
      expect(event.payload.actor_role).toBe('office_admin');
    });

    test('office_admin is BLOCKED (403) from creating users', async () => {
      const res = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ email: 'should-not-exist@test.com', name: 'Nope' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('office_admin is BLOCKED (403) from deleting users', async () => {
      const res = await request(app)
        .delete(`/api/auth/users/${secondAdmin.id}`)
        .set('Authorization', `Bearer ${oaToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    test('office_admin is BLOCKED (403) from changing roles', async () => {
      const res = await request(app)
        .put(`/api/auth/users/${secondAdmin.id}/role`)
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ role: 'office_admin' });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Last-admin invariant', () => {
    test('blocks demoting the last admin even when the new role is office_admin', async () => {
      // Force a state where adminUser is the ONLY admin in the system, by
      // demoting secondAdmin first via direct SQL.
      await executeQuery("UPDATE users SET role = 'user', is_admin = 0 WHERE id = ?", [secondAdmin.id]);

      const res = await request(app)
        .put(`/api/auth/users/${adminUser.id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'office_admin' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CANNOT_DEMOTE_LAST_ADMIN');

      // Restore secondAdmin so other tests aren't affected.
      await executeQuery("UPDATE users SET role = 'admin', is_admin = 1 WHERE id = ?", [secondAdmin.id]);
    });
  });
});
