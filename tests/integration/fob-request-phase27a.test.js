// Phase 27a integration tests: the new fob-request flag on desk bookings.
//
// 27a is the storage-only slice — no inventory enforcement yet (that
// lands in Phase 27b). This file pins:
//   - POST /api/bookings accepts `fobRequested: true` and stores it.
//   - The created booking JSON exposes `fobRequested`.
//   - GET /api/bookings/my-bookings reflects the flag.
//   - On a successful create with `fobRequested = true`, a
//     FOB_REQUEST_GRANTED audit event is emitted with the right payload.
//   - Omitting the flag preserves the previous default (fobRequested=false)
//     and emits no FOB_REQUEST_GRANTED row — the existing
//     DESK_BOOKING_CREATED row is sufficient for non-fob bookings.
//
// We use unique 2099 dates to avoid collisions with other suites.

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

describe('Phase 27a: fob_requested storage + FOB_REQUEST_GRANTED audit', () => {
  let userService;
  let adminUser;
  let adminToken;
  let regularUser;
  let regularToken;
  let deskId;

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

    try {
      regularUser = await userService.getUserByUsername('phase27a-fob@test.com');
    } catch (_) {
      regularUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'phase27a-fob@test.com',
        name: 'Phase 27a Fob User',
        password: 'Password123',
      });
    }
    regularToken = generateToken(regularUser);

    const deskRows = await executeQuery('SELECT id FROM desks WHERE is_active = TRUE LIMIT 1');
    if (deskRows.length > 0) {
      deskId = deskRows[0].id;
    } else {
      const r = await executeQuery(
        "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('PHASE27A-DESK', 'Test', 'Phase 27a test desk', TRUE)"
      );
      deskId = r.insertId;
    }
  });

  beforeEach(async () => {
    // Clear audit rows so the GRANTED-emission assertion is exact, and
    // remove any prior bookings so the per-user overlap guard doesn't
    // reject our new ones.
    await executeQuery('DELETE FROM audit_events');
    await executeQuery(
      "DELETE FROM bookings WHERE user_id = ? AND start_date BETWEEN '2099-09-01' AND '2099-09-30'",
      [regularUser.id]
    );
  });

  test('POST /api/bookings with fobRequested=true returns fobRequested:true and emits FOB_REQUEST_GRANTED', async () => {
    const date = '2099-09-12';

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ deskId, startDate: date, endDate: date, fobRequested: true });

    expect(res.status).toBe(201);
    expect(res.body.fobRequested).toBe(true);

    const granted = await getLatestEventByType('FOB_REQUEST_GRANTED');
    expect(granted).not.toBeNull();
    expect(granted.actor_id).toBe(regularUser.id);
    expect(granted.target_type).toBe('booking');
    expect(granted.target_id).toBe(res.body.id);
    expect(granted.payload.desk_id).toBe(deskId);
    expect(granted.payload.start_date).toBe(date);
    expect(granted.payload.end_date).toBe(date);
    expect(granted.payload.fob_requested).toBe(true);
  });

  test('POST /api/bookings without fobRequested defaults to false and emits no FOB_REQUEST_GRANTED row', async () => {
    const date = '2099-09-13';

    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ deskId, startDate: date, endDate: date });

    expect(res.status).toBe(201);
    expect(res.body.fobRequested).toBe(false);

    const granted = await getLatestEventByType('FOB_REQUEST_GRANTED');
    expect(granted).toBeNull();
  });

  test('GET /api/bookings/my-bookings reflects the flag for both fob and non-fob rows', async () => {
    const fobDate = '2099-09-14';
    const plainDate = '2099-09-15';

    const fobRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ deskId, startDate: fobDate, endDate: fobDate, fobRequested: true });
    expect(fobRes.status).toBe(201);

    const plainRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ deskId, startDate: plainDate, endDate: plainDate });
    expect(plainRes.status).toBe(201);

    const list = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', `Bearer ${regularToken}`);
    expect(list.status).toBe(200);

    const fobBooking = list.body.find((b) => b.id === fobRes.body.id);
    const plainBooking = list.body.find((b) => b.id === plainRes.body.id);
    expect(fobBooking).toBeDefined();
    expect(plainBooking).toBeDefined();
    expect(fobBooking.fobRequested).toBe(true);
    expect(plainBooking.fobRequested).toBe(false);
  });

  test('POST /api/bookings/bulk accepts fobRequested and emits one FOB_REQUEST_GRANTED per successful row', async () => {
    // Need a second active desk so bulk has more than one slot.
    let secondDeskId;
    const more = await executeQuery(
      "SELECT id FROM desks WHERE is_active = TRUE AND id <> ? ORDER BY id LIMIT 1",
      [deskId]
    );
    if (more.length > 0) {
      secondDeskId = more[0].id;
    } else {
      const r = await executeQuery(
        "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('PHASE27A-DESK-2', 'Test', 'Phase 27a second test desk', TRUE)"
      );
      secondDeskId = r.insertId;
    }

    const date = '2099-09-16';
    const res = await request(app)
      .post('/api/bookings/bulk')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({ deskIds: [deskId, secondDeskId], startDate: date, endDate: date, fobRequested: true });

    // 201 (all succeeded) or 207 (partial); accept both.
    expect([201, 207]).toContain(res.status);
    expect(Array.isArray(res.body.successful)).toBe(true);
    expect(res.body.successful.length).toBeGreaterThan(0);
    res.body.successful.forEach((b) => {
      expect(b.fobRequested).toBe(true);
    });

    const grantedRows = await executeQuery(
      "SELECT * FROM audit_events WHERE action_type = 'FOB_REQUEST_GRANTED' ORDER BY id"
    );
    expect(grantedRows.length).toBe(res.body.successful.length);
  });
});
