// Phase 27b integration tests: inventory enforcement + admin endpoints.
//
// Covers task 27.16 in full:
//   - Booking with fobRequested=true succeeds when inventory is unset
//     (already covered by Phase 27a; re-asserted here for completeness).
//   - Booking with fobRequested=true succeeds within inventory and
//     emits FOB_REQUEST_GRANTED.
//   - Booking with fobRequested=true fails with FOB_UNAVAILABLE when
//     over inventory and emits FOB_REQUEST_DENIED.
//   - Cancelling a fob booking releases the fob so the next booker on
//     that day succeeds.
//   - Calendar endpoint returns expected per-day required/available
//     counts.
//   - History endpoint returns past allocations including user name +
//     email; CSV export returns text/csv.
//   - Authorization: regular User receives 403 on fob admin endpoints;
//     Office Administrator and Administrator receive 200.

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
  const rows = await getEventsByType(actionType);
  return rows.length > 0 ? rows[0] : null;
}

describe('Phase 27b: fob inventory enforcement + admin endpoints', () => {
  let userService;
  let adminUser;
  let adminToken;
  let oaUser;
  let oaToken;
  let userA;
  let userAToken;
  let userB;
  let userBToken;
  let deskId;
  let secondDeskId;

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
      oaUser = await userService.getUserByUsername('phase27b-oa@test.com');
    } catch (_) {
      oaUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'phase27b-oa@test.com',
        name: 'Phase 27b OA',
        password: 'Password123',
        role: 'office_admin',
      });
    }
    // Force OA role even if helper ignored it.
    await executeQuery("UPDATE users SET role = 'office_admin', is_admin = 0 WHERE id = ?", [oaUser.id]);
    oaToken = generateToken({ ...oaUser, role: 'office_admin', isAdmin: false });

    try {
      userA = await userService.getUserByUsername('phase27b-userA@test.com');
    } catch (_) {
      userA = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'phase27b-userA@test.com',
        name: 'Phase 27b User A',
        password: 'Password123',
      });
    }
    userAToken = generateToken(userA);

    try {
      userB = await userService.getUserByUsername('phase27b-userB@test.com');
    } catch (_) {
      userB = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'phase27b-userB@test.com',
        name: 'Phase 27b User B',
        password: 'Password123',
      });
    }
    userBToken = generateToken(userB);

    const deskRows = await executeQuery('SELECT id FROM desks WHERE is_active = TRUE ORDER BY id LIMIT 2');
    if (deskRows.length >= 1) {
      deskId = deskRows[0].id;
    } else {
      const r = await executeQuery(
        "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('PHASE27B-DESK-1', 'Test', 'Phase 27b desk 1', TRUE)"
      );
      deskId = r.insertId;
    }
    if (deskRows.length >= 2) {
      secondDeskId = deskRows[1].id;
    } else {
      const r = await executeQuery(
        "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('PHASE27B-DESK-2', 'Test', 'Phase 27b desk 2', TRUE)"
      );
      secondDeskId = r.insertId;
    }
  });

  beforeEach(async () => {
    // Wipe inventory + audit + bookings in our test window so each test
    // starts from a known state.
    await executeQuery('DELETE FROM fob_inventory');
    await executeQuery('DELETE FROM audit_events');
    await executeQuery(
      "DELETE FROM bookings WHERE start_date BETWEEN '2099-10-01' AND '2099-10-31'"
    );
  });

  describe('Booking enforcement', () => {
    test('fobRequested=true succeeds when inventory is unset', async () => {
      const date = '2099-10-01';
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ deskId, startDate: date, endDate: date, fobRequested: true });
      expect(res.status).toBe(201);
      expect(res.body.fobRequested).toBe(true);

      const granted = await getLatestEventByType('FOB_REQUEST_GRANTED');
      expect(granted).not.toBeNull();
      const denied = await getLatestEventByType('FOB_REQUEST_DENIED');
      expect(denied).toBeNull();
    });

    test('fobRequested=true succeeds within inventory and emits FOB_REQUEST_GRANTED', async () => {
      // OA sets default of 1.
      const setRes = await request(app)
        .put('/api/admin/fob/inventory/default')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: 1 });
      expect(setRes.status).toBe(200);

      const date = '2099-10-02';
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ deskId, startDate: date, endDate: date, fobRequested: true });
      expect(res.status).toBe(201);

      const granted = await getLatestEventByType('FOB_REQUEST_GRANTED');
      expect(granted).not.toBeNull();
      expect(granted.payload.start_date).toBe(date);
    });

    test('fobRequested=true rejected with FOB_UNAVAILABLE when over inventory; emits FOB_REQUEST_DENIED', async () => {
      // Per-date override: 1 fob on 2099-10-03.
      const set = await request(app)
        .put('/api/admin/fob/inventory/2099-10-03')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: 1 });
      expect(set.status).toBe(200);

      // User A claims the only fob on the day.
      const a = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ deskId, startDate: '2099-10-03', endDate: '2099-10-03', fobRequested: true });
      expect(a.status).toBe(201);

      // User B tries; should be rejected with FOB_UNAVAILABLE on a
      // different desk so the desk-availability rule doesn't fire first.
      const b = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ deskId: secondDeskId, startDate: '2099-10-03', endDate: '2099-10-03', fobRequested: true });
      expect(b.status).toBe(400);
      expect(b.body.error.code).toBe('FOB_UNAVAILABLE');
      expect(b.body.error.offendingDates).toEqual(['2099-10-03']);

      const denied = await getLatestEventByType('FOB_REQUEST_DENIED');
      expect(denied).not.toBeNull();
      expect(denied.payload.offending_dates).toEqual(['2099-10-03']);
    });

    test('cancelling a fob booking releases the fob so the next booker on that day succeeds', async () => {
      const setRes = await request(app)
        .put('/api/admin/fob/inventory/2099-10-04')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: 1 });
      expect(setRes.status).toBe(200);

      // A claims, B is denied.
      const a = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ deskId, startDate: '2099-10-04', endDate: '2099-10-04', fobRequested: true });
      expect(a.status).toBe(201);

      const bDenied = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ deskId: secondDeskId, startDate: '2099-10-04', endDate: '2099-10-04', fobRequested: true });
      expect(bDenied.status).toBe(400);

      // A cancels, releasing the fob.
      const cancel = await request(app)
        .delete(`/api/bookings/${a.body.id}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(cancel.status).toBe(204);

      // B retries successfully.
      const bAgain = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ deskId: secondDeskId, startDate: '2099-10-04', endDate: '2099-10-04', fobRequested: true });
      expect(bAgain.status).toBe(201);
    });
  });

  describe('Calendar + history reports', () => {
    test('GET /api/admin/fob/calendar returns required vs available per day', async () => {
      // Default = 2; override 2099-10-05 to 1.
      await request(app)
        .put('/api/admin/fob/inventory/default')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: 2 });
      await request(app)
        .put('/api/admin/fob/inventory/2099-10-05')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: 1 });

      // Two fob bookings on 2099-10-06; one on 2099-10-05.
      const r1 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ deskId, startDate: '2099-10-06', endDate: '2099-10-06', fobRequested: true });
      expect(r1.status).toBe(201);
      const r2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ deskId: secondDeskId, startDate: '2099-10-06', endDate: '2099-10-06', fobRequested: true });
      expect(r2.status).toBe(201);
      const r3 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ deskId, startDate: '2099-10-05', endDate: '2099-10-05', fobRequested: true });
      expect(r3.status).toBe(201);

      const cal = await request(app)
        .get('/api/admin/fob/calendar?startDate=2099-10-05&endDate=2099-10-07')
        .set('Authorization', `Bearer ${oaToken}`);
      expect(cal.status).toBe(200);
      expect(cal.body.days).toHaveLength(3);

      const byDate = Object.fromEntries(cal.body.days.map((d) => [d.date, d]));
      expect(byDate['2099-10-05']).toEqual({ date: '2099-10-05', configured: 1, requested: 1, available: 0 });
      expect(byDate['2099-10-06']).toEqual({ date: '2099-10-06', configured: 2, requested: 2, available: 0 });
      expect(byDate['2099-10-07']).toEqual({ date: '2099-10-07', configured: 2, requested: 0, available: 2 });
    });

    test('GET /api/admin/fob/history returns rows including user info, CSV export sets Content-Type', async () => {
      const date = '2099-10-08';
      const r = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ deskId, startDate: date, endDate: date, fobRequested: true });
      expect(r.status).toBe(201);

      const json = await request(app)
        .get(`/api/admin/fob/history?startDate=${date}&endDate=${date}`)
        .set('Authorization', `Bearer ${oaToken}`);
      expect(json.status).toBe(200);
      expect(Array.isArray(json.body.rows)).toBe(true);
      expect(json.body.rows.length).toBeGreaterThanOrEqual(1);
      const row = json.body.rows.find((x) => x.id === r.body.id);
      expect(row).toBeDefined();
      // The auth layer lowercases emails on registration, so the stored
      // username/email is the lowercased form regardless of input casing.
      expect(row.userEmail.toLowerCase()).toBe('phase27b-usera@test.com');

      const csv = await request(app)
        .get(`/api/admin/fob/history?startDate=${date}&endDate=${date}&format=csv`)
        .set('Authorization', `Bearer ${oaToken}`);
      expect(csv.status).toBe(200);
      expect(csv.headers['content-type']).toMatch(/text\/csv/);
      expect(csv.text.split('\n')[0]).toBe('booking_id,user_email,user_name,desk_number,start_date,end_date,status');
      expect(csv.text.toLowerCase()).toContain('phase27b-usera@test.com');
    });
  });

  describe('Authorization', () => {
    test('regular User receives 403 on every fob admin endpoint', async () => {
      const endpoints = [
        ['get', '/api/admin/fob/inventory'],
        ['put', '/api/admin/fob/inventory/default', { count: 1 }],
        ['put', '/api/admin/fob/inventory/2099-10-09', { count: 1 }],
        ['delete', '/api/admin/fob/inventory/2099-10-09'],
        ['get', '/api/admin/fob/calendar?startDate=2099-10-01&endDate=2099-10-02'],
        ['get', '/api/admin/fob/history?startDate=2099-10-01&endDate=2099-10-02'],
      ];
      for (const [method, path, body] of endpoints) {
        const r = await request(app)[method](path)
          .set('Authorization', `Bearer ${userAToken}`)
          .send(body || {});
        expect(r.status).toBe(403);
      }
    });

    test('Office Administrator and Administrator both reach 200 on GET /inventory', async () => {
      const oa = await request(app).get('/api/admin/fob/inventory').set('Authorization', `Bearer ${oaToken}`);
      expect(oa.status).toBe(200);
      const adm = await request(app).get('/api/admin/fob/inventory').set('Authorization', `Bearer ${adminToken}`);
      expect(adm.status).toBe(200);
    });

    test('FOB_INVENTORY_DEFAULT_UPDATED audit row is recorded with previous_count -> new_count', async () => {
      const set1 = await request(app)
        .put('/api/admin/fob/inventory/default')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: 3 });
      expect(set1.status).toBe(200);
      const set2 = await request(app)
        .put('/api/admin/fob/inventory/default')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: 5 });
      expect(set2.status).toBe(200);

      const ev = await getLatestEventByType('FOB_INVENTORY_DEFAULT_UPDATED');
      expect(ev).not.toBeNull();
      expect(ev.payload.previous_count).toBe(3);
      expect(ev.payload.new_count).toBe(5);
      expect(ev.payload.actor_role).toBe('office_admin');
    });

    test('PUT /inventory/default rejects negative counts with INVALID_COUNT', async () => {
      const r = await request(app)
        .put('/api/admin/fob/inventory/default')
        .set('Authorization', `Bearer ${oaToken}`)
        .send({ count: -2 });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('INVALID_COUNT');
    });
  });
});
