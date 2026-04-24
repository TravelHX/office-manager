// Phase 21d (21.6-21.11): integration tests proving that the HTTP routes
// emit the expected audit rows via src/backend/utils/audit-helper.js.
//
// Each describe block corresponds to a bullet in docs/audit-events.md. The
// tests hit the real application through supertest and then query the
// audit_events table directly via executeQuery — we are verifying the
// side effect of the route, not the shape of GET /api/admin/audit-events
// (that surface is covered by audit.test.js).
//
// The beforeEach clears audit_events so each assertion starts clean.

const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

async function getEventsByType(actionType) {
  const rows = await executeQuery(
    'SELECT * FROM audit_events WHERE action_type = ? ORDER BY id DESC',
    [actionType]
  );
  return rows.map((row) => ({
    ...row,
    payload: typeof row.payload === 'string' && row.payload ? JSON.parse(row.payload) : row.payload,
  }));
}

async function getLatestEventByType(actionType) {
  const events = await getEventsByType(actionType);
  return events.length > 0 ? events[0] : null;
}

describe('Audit emissions (Phase 21d, tasks 21.6-21.11)', () => {
  let userService;
  let adminUser;
  let regularUser;
  let adminToken;
  let regularUserToken;

  beforeAll(async () => {
    userService = new UserService();

    // Reuse the standard admin fixture.
    try {
      adminUser = await userService.getUserByUsername('admin');
    } catch (error) {
      const passwordHash = require('../../src/backend/utils/password').hashPassword;
      const User = require('../../src/backend/models/User');
      const UserRepository = require('../../src/backend/repositories/UserRepository');
      const userRepo = new UserRepository();
      const hash = await passwordHash('Password123');
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

    try {
      regularUser = await userService.getUserByUsername('auditemittest@test.com');
    } catch (error) {
      regularUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'auditemittest@test.com',
        name: 'Audit Emit Test',
        password: 'Password123',
      });
    }

    adminToken = generateToken(adminUser);
    regularUserToken = generateToken(regularUser);
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM audit_events');
  });

  describe('Authentication (21.6)', () => {
    test('AUTH_LOGIN_SUCCESS is recorded on successful login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'auditemittest@test.com', password: 'Password123' });
      expect(res.status).toBe(200);

      const event = await getLatestEventByType('AUTH_LOGIN_SUCCESS');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
      expect(event.actor_email).toBe('auditemittest@test.com');
    });

    test('AUTH_LOGIN_FAILURE is recorded on bad password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'auditemittest@test.com', password: 'wrong-password' });
      expect(res.status).toBe(401);

      const event = await getLatestEventByType('AUTH_LOGIN_FAILURE');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBeNull();
      expect(event.payload).toEqual(
        expect.objectContaining({
          attempted_email: 'auditemittest@test.com',
          reason: 'invalid_credentials',
        })
      );
    });

    test('AUTH_LOGIN_FAILURE is recorded for unknown user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody@test.com', password: 'whatever' });
      expect(res.status).toBe(401);

      const event = await getLatestEventByType('AUTH_LOGIN_FAILURE');
      expect(event).not.toBeNull();
      expect(event.payload).toEqual(
        expect.objectContaining({
          attempted_email: 'nobody@test.com',
          reason: 'unknown_user',
        })
      );
    });

    test('AUTH_LOGOUT is recorded on logout', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(res.status).toBe(200);

      const event = await getLatestEventByType('AUTH_LOGOUT');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
    });
  });

  describe('Desk bookings (21.7)', () => {
    let deskId;
    beforeAll(async () => {
      // Ensure at least one desk exists.
      const rows = await executeQuery('SELECT id FROM desks WHERE is_active = TRUE LIMIT 1');
      if (rows.length > 0) {
        deskId = rows[0].id;
      } else {
        const result = await executeQuery(
          "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('AUDIT-EMIT-DESK', 'Test', 'Audit emission test desk', TRUE)"
        );
        deskId = result.insertId;
      }
    });

    test('DESK_BOOKING_CREATED on POST /api/bookings', async () => {
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ deskId, startDate: '2099-01-01', endDate: '2099-01-01' });
      expect([201]).toContain(res.status);

      const event = await getLatestEventByType('DESK_BOOKING_CREATED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
      expect(event.target_type).toBe('booking');
      expect(event.payload).toEqual(
        expect.objectContaining({
          desk_id: deskId,
          start_date: '2099-01-01',
          end_date: '2099-01-01',
        })
      );

      // Clean up the booking so other tests aren't affected.
      const bookingId = event.target_id;
      await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${regularUserToken}`);
    });

    test('DESK_BOOKING_CANCELLED_BY_USER on owner DELETE', async () => {
      const create = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ deskId, startDate: '2099-02-01', endDate: '2099-02-01' });
      expect([201]).toContain(create.status);
      const bookingId = create.body.id;

      const del = await request(app)
        .delete(`/api/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(del.status).toBe(204);

      const event = await getLatestEventByType('DESK_BOOKING_CANCELLED_BY_USER');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
      expect(event.target_id).toBe(bookingId);
      expect(event.payload).toEqual(
        expect.objectContaining({
          desk_id: deskId,
        })
      );
    });

    test('DESK_BOOKING_CANCELLED_BY_ADMIN on admin DELETE', async () => {
      const create = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ deskId, startDate: '2099-03-01', endDate: '2099-03-01' });
      expect([201]).toContain(create.status);
      const bookingId = create.body.id;

      const del = await request(app)
        .delete(`/api/admin/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'audit emission test' });
      expect(del.status).toBe(204);

      const event = await getLatestEventByType('DESK_BOOKING_CANCELLED_BY_ADMIN');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(adminUser.id);
      expect(event.target_id).toBe(bookingId);
      expect(event.payload).toEqual(
        expect.objectContaining({
          booking_user_id: regularUser.id,
          desk_id: deskId,
          reason: 'audit emission test',
        })
      );
    });
  });

  describe('Parking reservations (21.8)', () => {
    let parkingSpaceId;
    beforeAll(async () => {
      const rows = await executeQuery('SELECT id FROM parking_spaces WHERE is_active = TRUE LIMIT 1');
      if (rows.length > 0) {
        parkingSpaceId = rows[0].id;
      } else {
        const result = await executeQuery(
          "INSERT INTO parking_spaces (space_number, location, description, is_active) VALUES ('AUDIT-EMIT-SPACE', 'Lot', 'Audit emission test space', TRUE)"
        );
        parkingSpaceId = result.insertId;
      }
    });

    test('PARKING_RESERVATION_CREATED on POST', async () => {
      const res = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ parkingSpaceId, reservationDate: '2099-04-01', timePeriod: 'morning' });
      expect([201]).toContain(res.status);

      const event = await getLatestEventByType('PARKING_RESERVATION_CREATED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
      expect(event.target_type).toBe('parking_reservation');
      expect(event.payload).toEqual(
        expect.objectContaining({
          parking_space_id: parkingSpaceId,
          reservation_date: '2099-04-01',
          time_period: 'morning',
        })
      );

      // Cleanup
      await request(app)
        .delete(`/api/parking-reservations/${event.target_id}`)
        .set('Authorization', `Bearer ${regularUserToken}`);
    });

    test('PARKING_RESERVATION_CANCELLED_BY_USER on owner DELETE', async () => {
      const create = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ parkingSpaceId, reservationDate: '2099-05-01', timePeriod: 'afternoon' });
      expect([201]).toContain(create.status);
      const reservationId = create.body.id;

      const del = await request(app)
        .delete(`/api/parking-reservations/${reservationId}`)
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(del.status).toBe(204);

      const event = await getLatestEventByType('PARKING_RESERVATION_CANCELLED_BY_USER');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
      expect(event.target_id).toBe(reservationId);
      expect(event.payload).toEqual(
        expect.objectContaining({
          parking_space_id: parkingSpaceId,
          time_period: 'afternoon',
        })
      );
    });

    test('PARKING_RESERVATION_CANCELLED_BY_ADMIN on admin DELETE', async () => {
      const create = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ parkingSpaceId, reservationDate: '2099-06-01', timePeriod: 'full_day' });
      expect([201]).toContain(create.status);
      const reservationId = create.body.id;

      const del = await request(app)
        .delete(`/api/admin/parking-reservations/${reservationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'audit emission test admin parking' });
      expect(del.status).toBe(204);

      const event = await getLatestEventByType('PARKING_RESERVATION_CANCELLED_BY_ADMIN');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(adminUser.id);
      expect(event.target_id).toBe(reservationId);
      expect(event.payload).toEqual(
        expect.objectContaining({
          reservation_user_id: regularUser.id,
          parking_space_id: parkingSpaceId,
          reason: 'audit emission test admin parking',
        })
      );
    });
  });

  describe('Admin configuration (21.9)', () => {
    test('ADMIN_CONFIG_UPDATED on PUT /api/admin/configuration/desk-count', async () => {
      // The service quantises the requested count against the number of
      // already-existing active desks, so we don't assert an exact `after`
      // value — just that the emission happened with the correct shape.
      const cfg = await request(app)
        .get('/api/admin/configuration')
        .set('Authorization', `Bearer ${adminToken}`);
      const currentDeskCount = cfg.body.deskCount || 0;
      const newCount = currentDeskCount + 1;

      const res = await request(app)
        .put('/api/admin/configuration/desk-count')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ deskCount: newCount, numberingMode: 'auto', startNumber: 1 });
      expect(res.status).toBe(200);

      const event = await getLatestEventByType('ADMIN_CONFIG_UPDATED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(adminUser.id);
      expect(event.target_type).toBe('admin_config');
      expect(event.payload.changed_keys).toEqual(['deskCount']);
      expect(event.payload.before).toEqual(expect.objectContaining({ deskCount: currentDeskCount }));
      expect(event.payload.after).toEqual(
        expect.objectContaining({ deskCount: expect.any(Number) })
      );
      expect(event.payload.numbering_mode).toBe('auto');
    });
  });

  describe('User management (21.10)', () => {
    test('USER_CREATED on admin provisioning', async () => {
      const uniqueEmail = `audit-prov-${Date.now()}@test.com`;
      const res = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: uniqueEmail, name: 'Audit Prov Target' });
      expect(res.status).toBe(201);

      const event = await getLatestEventByType('USER_CREATED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(adminUser.id);
      expect(event.target_type).toBe('user');
      expect(event.payload).toEqual(
        expect.objectContaining({
          created_email: uniqueEmail,
          is_admin: false,
          path: 'admin_provision',
        })
      );
    });

    test('USER_DELETED on admin delete', async () => {
      const uniqueEmail = `audit-del-${Date.now()}@test.com`;
      const createRes = await request(app)
        .post('/api/auth/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: uniqueEmail, name: 'Audit Delete Target' });
      expect(createRes.status).toBe(201);
      const targetId = createRes.body.id;

      // Wipe audit rows so we isolate the delete emission.
      await executeQuery('DELETE FROM audit_events');

      const delRes = await request(app)
        .delete(`/api/auth/users/${targetId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(204);

      const event = await getLatestEventByType('USER_DELETED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(adminUser.id);
      expect(event.target_id).toBe(targetId);
      expect(event.payload).toEqual(
        expect.objectContaining({
          deleted_user_id: targetId,
          deleted_email: uniqueEmail,
        })
      );
    });

    test('USER_PASSWORD_CHANGED on self password change', async () => {
      // Use a dedicated user so we can freely change the password.
      const pwUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: `audit-pw-${Date.now()}@test.com`,
        name: 'Audit PW User',
        password: 'Original123!',
      });
      const pwToken = generateToken(pwUser);

      await executeQuery('DELETE FROM audit_events');

      const res = await request(app)
        .put('/api/auth/users/password')
        .set('Authorization', `Bearer ${pwToken}`)
        .send({ currentPassword: 'Original123!', newPassword: 'Changed123!' });
      expect(res.status).toBe(200);

      const event = await getLatestEventByType('USER_PASSWORD_CHANGED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(pwUser.id);
      expect(event.target_id).toBe(pwUser.id);
      expect(event.payload).toEqual(
        expect.objectContaining({
          target_user_id: pwUser.id,
          initiator: 'self',
        })
      );
    });
  });

  describe('Bulk booking (21.11)', () => {
    let deskIds;
    beforeAll(async () => {
      const rows = await executeQuery(
        'SELECT id FROM desks WHERE is_active = TRUE ORDER BY id LIMIT 2'
      );
      deskIds = rows.map((r) => r.id);
    });

    test('DESK_BOOKING_BULK_CREATED on POST /api/bookings/bulk', async () => {
      if (!deskIds || deskIds.length < 1) {
        // Skip if the test environment has no desks; the pre-existing
        // availability tests are responsible for ensuring there is stock.
        return;
      }
      const res = await request(app)
        .post('/api/bookings/bulk')
        .set('Authorization', `Bearer ${regularUserToken}`)
        .send({ deskIds, startDate: '2099-07-01', endDate: '2099-07-01' });
      // 201 (all succeeded) or 207 (partial). Anything else means the
      // route didn't reach the emission point.
      expect([201, 207]).toContain(res.status);

      const event = await getLatestEventByType('DESK_BOOKING_BULK_CREATED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(regularUser.id);
      expect(event.payload).toEqual(
        expect.objectContaining({
          desk_ids: deskIds,
          start_date: '2099-07-01',
          end_date: '2099-07-01',
        })
      );
      expect(typeof event.payload.successful_count).toBe('number');
      expect(typeof event.payload.failed_count).toBe('number');
    });
  });
});
