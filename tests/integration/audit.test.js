// Phase 21b integration tests for GET /api/admin/audit-events.
//
// These tests run against the real MySQL test database (see
// utils/run-integration-tests.ps1). They verify:
//   - admin-only access (401 / 403 for unauthorised and non-admin callers)
//   - empty list for admin when no events present
//   - events come back newest first, mapped to camelCase API shape
//   - single-field substring search matches action_type, actor_email,
//     summary, and payload text
//   - limit / offset pagination behaves
//
// Phase 21b adds no emission wiring, so tests seed audit rows by calling
// AuditService.logEvent() directly.

const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const UserService = require('../../src/backend/services/UserService');
const AuditService = require('../../src/backend/services/AuditService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

describe('GET /api/admin/audit-events (Phase 21b)', () => {
  let userService;
  let auditService;
  let adminUser;
  let regularUser;
  let adminToken;
  let regularUserToken;

  beforeAll(async () => {
    userService = new UserService();
    auditService = new AuditService();

    // Reuse the standard admin fixture used across the integration suite.
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
      regularUser = await userService.getUserByUsername('audittestuser@test.com');
    } catch (error) {
      regularUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'audittestuser@test.com',
        name: 'Audit Test User',
        password: 'Password123',
      });
    }

    adminToken = generateToken(adminUser);
    regularUserToken = generateToken(regularUser);
  });

  beforeEach(async () => {
    // Each test seeds the rows it cares about; start from a clean table so
    // tests are idempotent regardless of execution order.
    await executeQuery('DELETE FROM audit_events');
  });

  describe('Authorisation', () => {
    test('401 when no Authorization header is provided', async () => {
      const response = await request(app).get('/api/admin/audit-events');
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    test('403 when caller is authenticated but not an admin', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events')
        .set('Authorization', `Bearer ${regularUserToken}`);
      expect(response.status).toBe(403);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('Listing', () => {
    test('returns an empty array when no events exist', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events).toEqual([]);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(0);
    });

    test('returns events in camelCase with payload parsed, newest first', async () => {
      await auditService.logEvent({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actionType: 'DESK_BOOKING_CREATED',
        targetType: 'booking',
        targetId: 101,
        summary: 'Booked desk D001',
        payload: { desk_id: 3, start_date: '2026-05-01', end_date: '2026-05-02' },
        ipAddress: '10.0.0.1',
      });
      await auditService.logEvent({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actionType: 'AUTH_LOGOUT',
      });

      const response = await request(app)
        .get('/api/admin/audit-events')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(2);

      // Newest first: AUTH_LOGOUT was inserted after DESK_BOOKING_CREATED.
      expect(response.body.events[0].actionType).toBe('AUTH_LOGOUT');
      expect(response.body.events[1].actionType).toBe('DESK_BOOKING_CREATED');

      const deskEvent = response.body.events[1];
      // Shape must be camelCase (no snake_case leakage).
      expect(deskEvent.occurredAt).toBeDefined();
      expect(deskEvent.actorEmail).toBe(adminUser.email);
      expect(deskEvent.targetType).toBe('booking');
      expect(deskEvent.targetId).toBe(101);
      expect(deskEvent.summary).toBe('Booked desk D001');
      expect(deskEvent.payload).toEqual({
        desk_id: 3,
        start_date: '2026-05-01',
        end_date: '2026-05-02',
      });
      expect(deskEvent.ipAddress).toBe('10.0.0.1');
      // Raw snake_case keys must not appear on the response.
      expect(deskEvent).not.toHaveProperty('action_type');
      expect(deskEvent).not.toHaveProperty('actor_email');
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      await auditService.logEvent({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actionType: 'AUTH_LOGIN_SUCCESS',
      });
      await auditService.logEvent({
        actorId: regularUser.id,
        actorEmail: regularUser.email,
        actionType: 'DESK_BOOKING_CREATED',
        summary: 'Booked desk D001 for two days',
        payload: { desk_id: 3 },
      });
      await auditService.logEvent({
        actorId: adminUser.id,
        actorEmail: adminUser.email,
        actionType: 'USER_DELETED',
        summary: 'Admin removed user 42',
        payload: { deleted_user_id: 42, deleted_email: 'gone@test.com' },
      });
    });

    test('empty search returns all events', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?search=')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(3);
    });

    test('matches action_type substring', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?search=LOGIN')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].actionType).toBe('AUTH_LOGIN_SUCCESS');
    });

    test('matches actor_email substring', async () => {
      const response = await request(app)
        .get(`/api/admin/audit-events?search=${encodeURIComponent('audittestuser')}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].actorEmail).toBe(regularUser.email);
    });

    test('matches summary substring', async () => {
      const response = await request(app)
        .get(`/api/admin/audit-events?search=${encodeURIComponent('two days')}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].summary).toContain('two days');
    });

    test('matches payload text (e.g. embedded user id)', async () => {
      const response = await request(app)
        .get(`/api/admin/audit-events?search=${encodeURIComponent('gone@test.com')}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0].actionType).toBe('USER_DELETED');
    });

    test('returns empty array when search matches nothing', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?search=doesnotmatchanythinginthefixture')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toEqual([]);
    });
  });

  describe('Pagination', () => {
    beforeEach(async () => {
      // Seed 5 events in a known order.
      for (let i = 1; i <= 5; i++) {
        await auditService.logEvent({
          actorId: adminUser.id,
          actorEmail: adminUser.email,
          actionType: 'AUTH_LOGOUT',
          summary: `event ${i}`,
        });
      }
    });

    test('defaults to limit=50 offset=0 and returns all seeded rows', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(5);
      expect(response.body.limit).toBe(50);
      expect(response.body.offset).toBe(0);
    });

    test('respects an explicit limit', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?limit=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(2);
      expect(response.body.limit).toBe(2);
      expect(response.body.offset).toBe(0);
    });

    test('respects an explicit offset', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?limit=2&offset=2')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.events).toHaveLength(2);
      expect(response.body.offset).toBe(2);
      // With newest-first ordering and 5 identical action types, rows 3-4 of the
      // newest-first sequence are event 3 and event 2 (i.e. middle of the run).
      const summaries = response.body.events.map((e) => e.summary);
      expect(summaries).toEqual(['event 3', 'event 2']);
    });

    test('caps an excessive limit at 500 to prevent unbounded pulls', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?limit=10000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(500);
    });

    test('rejects negative limit with 400 and a clear error code', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?limit=-5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_PAGINATION');
    });

    test('rejects non-numeric offset with 400', async () => {
      const response = await request(app)
        .get('/api/admin/audit-events?offset=abc')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_PAGINATION');
    });
  });
});
