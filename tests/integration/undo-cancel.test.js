// Phase 23c integration tests: user cancels a desk booking, then undoes
// the cancellation via POST /api/bookings/:id/undo-cancel.
//
// Scenarios verified here against the live test database:
//   - Happy path: cancel + undo within the window restores status=active
//     and emits DESK_BOOKING_RESTORED.
//   - Expired window: simulated by manually ageing `cancelled_at` past the
//     window; undo returns 400 UNDO_EXPIRED.
//   - Desk taken during the window: another booking consumes the desk for
//     the same dates; undo returns 409 DESK_UNAVAILABLE.
//   - Admin-cancelled bookings cannot be undone via this endpoint
//     (403 FORBIDDEN).
//
// The non-trivial scenarios rely on directly nudging `cancelled_at` in SQL
// rather than waiting 30 seconds of wall clock. The service enforces the
// window as `now - cancelled_at > UNDO_CANCEL_WINDOW_MS`, so setting
// cancelled_at in the past produces the same effect deterministically.

const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const UserService = require('../../src/backend/services/UserService');
const BookingService = require('../../src/backend/services/BookingService');
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

describe('Undo desk booking cancel (Phase 23c, task 23.11 / 23.13)', () => {
  let userService;
  let adminUser;
  let adminToken;
  let userA;
  let userAToken;
  let userB;
  let userBToken;
  let deskId;

  beforeAll(async () => {
    userService = new UserService();

    try {
      adminUser = await userService.getUserByUsername('admin');
    } catch (_) {
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
    adminToken = generateToken(adminUser);

    userA = await (async () => {
      try { return await userService.getUserByUsername('undoA@test.com'); }
      catch (_) {
        return await createProvisionedUserWithPassword(adminUser.id, {
          email: 'undoA@test.com', name: 'Undo A', password: 'Password123',
        });
      }
    })();
    userAToken = generateToken(userA);

    userB = await (async () => {
      try { return await userService.getUserByUsername('undoB@test.com'); }
      catch (_) {
        return await createProvisionedUserWithPassword(adminUser.id, {
          email: 'undoB@test.com', name: 'Undo B', password: 'Password123',
        });
      }
    })();
    userBToken = generateToken(userB);

    // Make sure at least one desk exists.
    const rows = await executeQuery('SELECT id FROM desks WHERE is_active = TRUE LIMIT 1');
    if (rows.length > 0) {
      deskId = rows[0].id;
    } else {
      const result = await executeQuery(
        "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('UNDO-TEST', 'Test', 'Undo test desk', TRUE)"
      );
      deskId = result.insertId;
    }
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM audit_events');
  });

  async function createBooking(token, dates) {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send({ deskId, startDate: dates.start, endDate: dates.end });
    expect([201]).toContain(res.status);
    return res.body;
  }

  async function cancelOwnBooking(token, bookingId) {
    const res = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
    return res;
  }

  async function undoOwnCancel(token, bookingId) {
    return request(app)
      .post(`/api/bookings/${bookingId}/undo-cancel`)
      .set('Authorization', `Bearer ${token}`);
  }

  test('DELETE response includes X-Undo-Window-Ms header', async () => {
    const created = await createBooking(userAToken, { start: '2099-08-01', end: '2099-08-01' });
    const res = await cancelOwnBooking(userAToken, created.id);
    const header = res.headers['x-undo-window-ms'];
    expect(Number.parseInt(header, 10)).toBe(BookingService.UNDO_CANCEL_WINDOW_MS);
  });

  test('undo within the window restores booking and emits DESK_BOOKING_RESTORED', async () => {
    const created = await createBooking(userAToken, { start: '2099-08-02', end: '2099-08-02' });
    await cancelOwnBooking(userAToken, created.id);

    const res = await undoOwnCancel(userAToken, created.id);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.id);
    expect(res.body.status).toBe('active');
    // Cancellation metadata should have been cleared on restore.
    expect(res.body.cancelledAt).toBeFalsy();
    expect(res.body.cancelledBy).toBeFalsy();

    const event = await getLatestEventByType('DESK_BOOKING_RESTORED');
    expect(event).not.toBeNull();
    expect(event.actor_id).toBe(userA.id);
    expect(event.target_id).toBe(created.id);
    // Dates in the payload come from the Booking model's `startDate` /
    // `endDate`, which the MySQL driver returns as a Date — JSON.stringify
    // serialises these as ISO datetimes. Assert the date prefix rather than
    // the exact string so the test is robust to driver date-format tweaks.
    expect(event.payload.desk_id).toBe(deskId);
    expect(event.payload.undo_within_ms).toBe(BookingService.UNDO_CANCEL_WINDOW_MS);
    expect(String(event.payload.start_date)).toMatch(/^2099-08-02/);
    expect(String(event.payload.end_date)).toMatch(/^2099-08-02/);

    // Cleanup.
    await cancelOwnBooking(userAToken, created.id);
  });

  test('expired window rejects undo with 400 UNDO_EXPIRED', async () => {
    const created = await createBooking(userAToken, { start: '2099-08-03', end: '2099-08-03' });
    await cancelOwnBooking(userAToken, created.id);

    // Age cancelled_at past the configured window (in seconds of wall clock).
    const ageSeconds = Math.ceil(BookingService.UNDO_CANCEL_WINDOW_MS / 1000) + 5;
    await executeQuery(
      'UPDATE bookings SET cancelled_at = DATE_SUB(NOW(), INTERVAL ? SECOND) WHERE id = ?',
      [ageSeconds, created.id]
    );

    const res = await undoOwnCancel(userAToken, created.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('UNDO_EXPIRED');
  });

  test('rejects 403 when another user tries to undo your cancel', async () => {
    const created = await createBooking(userAToken, { start: '2099-08-04', end: '2099-08-04' });
    await cancelOwnBooking(userAToken, created.id);

    const res = await undoOwnCancel(userBToken, created.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');

    // Clean up by letting the original owner undo (still within window).
    await undoOwnCancel(userAToken, created.id);
    await cancelOwnBooking(userAToken, created.id);
  });

  test('rejects 403 when booking was cancelled by an admin, not self', async () => {
    const created = await createBooking(userAToken, { start: '2099-08-05', end: '2099-08-05' });

    // Admin cancels (not self).
    const adminDel = await request(app)
      .delete(`/api/admin/bookings/${created.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'admin initiated' });
    expect(adminDel.status).toBe(204);

    const res = await undoOwnCancel(userAToken, created.id);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toMatch(/self-cancellations/i);
  });

  test('rejects 409 DESK_UNAVAILABLE when another booking took the desk during the window', async () => {
    // User A books + cancels desk for 2099-08-06.
    const created = await createBooking(userAToken, { start: '2099-08-06', end: '2099-08-06' });
    await cancelOwnBooking(userAToken, created.id);

    // User B races in and books the same desk on the same day.
    const usurp = await createBooking(userBToken, { start: '2099-08-06', end: '2099-08-06' });

    // User A tries to undo — desk is no longer available.
    const res = await undoOwnCancel(userAToken, created.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DESK_UNAVAILABLE');

    // Cleanup the conflict.
    await cancelOwnBooking(userBToken, usurp.id);
  });

  test('rejects 404 when booking does not exist', async () => {
    const res = await undoOwnCancel(userAToken, 9_999_999);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('BOOKING_NOT_FOUND');
  });

  test('rejects 400 NOT_CANCELLED when booking is still active', async () => {
    const created = await createBooking(userAToken, { start: '2099-08-07', end: '2099-08-07' });
    const res = await undoOwnCancel(userAToken, created.id);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('NOT_CANCELLED');

    // Cleanup.
    await cancelOwnBooking(userAToken, created.id);
  });
});
