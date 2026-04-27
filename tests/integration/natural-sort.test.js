// Phase 24 integration tests for natural-numeric ordering of desks and
// parking spaces. Asserts that GET /api/desks and GET /api/parking-spaces
// return resources in natural numeric order (1, 2, 3, …, 10, 11) when the
// underlying numbering would sort incorrectly as strings.
//
// Seeds desks / spaces inside the test, runs the API, and cleans up.
// Uses the standard admin fixture from the existing integration suite.

const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');

// Numbers that sort incorrectly as strings — '10' lands between '1' and
// '2' under lexical order — so the test fails if the server returns
// alphabetic order.
const TEST_DESK_NUMBERS = ['1', '2', '3', '10', '11'];
const TEST_SPACE_NUMBERS = ['1', '2', '3', '10', '11'];

describe('Natural numeric ordering (Phase 24, tasks 24.16 / 24.17)', () => {
  let userService;
  let adminUser;
  let adminToken;
  let seededDeskIds = [];
  let seededSpaceIds = [];

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

    // Seed desks / parking spaces with numbers that lexically sort wrong.
    // Use INSERT IGNORE-style to coexist with anything already present in
    // the test DB.
    for (const n of TEST_DESK_NUMBERS) {
      const deskNumber = `NSORT-${n}`;
      const existing = await executeQuery('SELECT id FROM desks WHERE desk_number = ?', [deskNumber]);
      if (existing.length > 0) {
        seededDeskIds.push(existing[0].id);
      } else {
        const result = await executeQuery(
          "INSERT INTO desks (desk_number, location, description, is_active) VALUES (?, 'Test', 'Phase 24 ordering test', TRUE)",
          [deskNumber]
        );
        seededDeskIds.push(result.insertId);
      }
    }
    for (const n of TEST_SPACE_NUMBERS) {
      const spaceNumber = `NSORT-${n}`;
      const existing = await executeQuery('SELECT id FROM parking_spaces WHERE space_number = ?', [spaceNumber]);
      if (existing.length > 0) {
        seededSpaceIds.push(existing[0].id);
      } else {
        const result = await executeQuery(
          "INSERT INTO parking_spaces (space_number, location, description, is_active) VALUES (?, 'Test', 'Phase 24 ordering test', TRUE)",
          [spaceNumber]
        );
        seededSpaceIds.push(result.insertId);
      }
    }
  });

  afterAll(async () => {
    // Clean up the seeded rows so the test is idempotent across runs.
    if (seededDeskIds.length > 0) {
      await executeQuery(
        `DELETE FROM desks WHERE id IN (${seededDeskIds.map(() => '?').join(',')})`,
        seededDeskIds
      );
    }
    if (seededSpaceIds.length > 0) {
      await executeQuery(
        `DELETE FROM parking_spaces WHERE id IN (${seededSpaceIds.map(() => '?').join(',')})`,
        seededSpaceIds
      );
    }
  });

  function naturalIndex(numbers, list, prefix = 'NSORT-') {
    // Filter the list to just the seeded rows and return their order.
    const seededOrder = list
      .map((row) => row.deskNumber || row.spaceNumber)
      .filter((n) => typeof n === 'string' && n.startsWith(prefix))
      .map((n) => n.slice(prefix.length));
    return seededOrder;
  }

  test('GET /api/desks returns desks in natural numeric order', async () => {
    const res = await request(app)
      .get('/api/desks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const order = naturalIndex(TEST_DESK_NUMBERS, res.body);
    // Expected order: 1, 2, 3, 10, 11 — *not* the alphabetic 1, 10, 11, 2, 3.
    expect(order).toEqual(TEST_DESK_NUMBERS);
  });

  test('GET /api/admin/desks returns desks in natural numeric order', async () => {
    const res = await request(app)
      .get('/api/admin/desks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(naturalIndex(TEST_DESK_NUMBERS, res.body)).toEqual(TEST_DESK_NUMBERS);
  });

  test('GET /api/parking-spaces returns parking spaces in natural numeric order', async () => {
    const res = await request(app)
      .get('/api/parking-spaces')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(naturalIndex(TEST_SPACE_NUMBERS, res.body)).toEqual(TEST_SPACE_NUMBERS);
  });

  test('GET /api/admin/parking-spaces returns parking spaces in natural numeric order', async () => {
    const res = await request(app)
      .get('/api/admin/parking-spaces')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(naturalIndex(TEST_SPACE_NUMBERS, res.body)).toEqual(TEST_SPACE_NUMBERS);
  });

  test('GET /api/bookings/available returns available desks in natural numeric order', async () => {
    // Pick a date far in the future so the seeded NSORT-* desks are all
    // available regardless of other tests.
    const date = '2099-09-15';
    const res = await request(app)
      .get(`/api/bookings/available?startDate=${date}&endDate=${date}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const desks = res.body.availableDesks || [];
    expect(naturalIndex(TEST_DESK_NUMBERS, desks)).toEqual(TEST_DESK_NUMBERS);
  });

  test('GET /api/parking-spaces/available returns available spaces in natural numeric order', async () => {
    const date = '2099-09-15';
    const res = await request(app)
      .get(`/api/parking-spaces/available?reservationDate=${date}&timePeriod=full_day`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const spaces = res.body.availableSpaces || [];
    expect(naturalIndex(TEST_SPACE_NUMBERS, spaces)).toEqual(TEST_SPACE_NUMBERS);
  });
});
