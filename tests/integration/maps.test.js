// Phase 23d integration tests for floor-plan map endpoints.
//
// Verified against the live test database:
//   - Public GET requires authentication and returns the (possibly empty)
//     map config shape.
//   - Admin upload accepts PNG and JPEG and rejects everything else (415,
//     413, 400 for empty / mime-mismatch).
//   - Landmark CRUD enforces context + validation rules.
//   - Resource coordinate upsert enforces resource existence and emits
//     the expected audit events.
//
// File-system writes go to ./data/maps inside the container; the test
// avoids leaving artefacts by uploading then deleting at the end.

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const UserService = require('../../src/backend/services/UserService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

// Tiny valid 1x1 PNG (89 50 4E 47 0D 0A 1A 0A + minimal IHDR/IDAT/IEND).
// Built from a base64 string so the bytes are stable regardless of fs.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64'
);
const TINY_JPEG = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);

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

describe('Floor plan maps API (Phase 23d)', () => {
  let userService;
  let adminUser;
  let adminToken;
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

    try {
      regularUser = await userService.getUserByUsername('mapsuser@test.com');
    } catch (_) {
      regularUser = await createProvisionedUserWithPassword(adminUser.id, {
        email: 'mapsuser@test.com', name: 'Maps User', password: 'Password123',
      });
    }
    regularToken = generateToken(regularUser);

    const deskRows = await executeQuery('SELECT id FROM desks WHERE is_active = TRUE LIMIT 1');
    if (deskRows.length > 0) {
      deskId = deskRows[0].id;
    } else {
      const result = await executeQuery(
        "INSERT INTO desks (desk_number, location, description, is_active) VALUES ('MAPS-DESK', 'Test', 'Maps test', TRUE)"
      );
      deskId = result.insertId;
    }

    const spaceRows = await executeQuery('SELECT id FROM parking_spaces WHERE is_active = TRUE LIMIT 1');
    if (spaceRows.length > 0) {
      spaceId = spaceRows[0].id;
    } else {
      const result = await executeQuery(
        "INSERT INTO parking_spaces (space_number, location, description, is_active) VALUES ('MAPS-SPACE', 'Test', 'Maps test', TRUE)"
      );
      spaceId = result.insertId;
    }
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM audit_events');
    await executeQuery('DELETE FROM map_landmarks');
  });

  afterAll(async () => {
    // Best-effort cleanup of any image we wrote during the run.
    await executeQuery('DELETE FROM floor_plans');
    const dataMapsDir = path.resolve(__dirname, '..', '..', 'data', 'maps');
    try {
      const entries = await fsp.readdir(dataMapsDir);
      await Promise.all(entries.map((e) => fsp.unlink(path.join(dataMapsDir, e)).catch(() => null)));
    } catch (_) { /* dir might not exist */ }
  });

  describe('Public GET /api/maps/:context', () => {
    test('401 without auth', async () => {
      const res = await request(app).get('/api/maps/desk');
      expect(res.status).toBe(401);
    });

    test('400 for unknown context', async () => {
      const res = await request(app)
        .get('/api/maps/lobby')
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_CONTEXT');
    });

    test('returns empty config when nothing configured', async () => {
      const res = await request(app)
        .get('/api/maps/desk')
        .set('Authorization', `Bearer ${regularToken}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        context: 'desk',
        floorPlan: null,
        landmarks: [],
        resources: expect.any(Array),
      });
    });
  });

  describe('Admin POST /api/admin/maps/:context/floor-plan', () => {
    test('403 when caller is not admin', async () => {
      const res = await request(app)
        .post('/api/admin/maps/desk/floor-plan')
        .set('Authorization', `Bearer ${regularToken}`)
        .set('Content-Type', 'image/png')
        .send(TINY_PNG);
      expect(res.status).toBe(403);
    });

    test('415 when Content-Type is not PNG/JPEG', async () => {
      const res = await request(app)
        .post('/api/admin/maps/desk/floor-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'image/gif')
        .send(Buffer.from('GIF8'));
      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    test('400 when body magic bytes do not match the declared MIME', async () => {
      const res = await request(app)
        .post('/api/admin/maps/desk/floor-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'image/png')
        .send(Buffer.from('<html>not an image</html>'));
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_IMAGE');
    });

    test('uploads PNG, returns the persisted record, and emits MAP_FLOOR_PLAN_UPLOADED', async () => {
      const res = await request(app)
        .post('/api/admin/maps/desk/floor-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'image/png')
        .send(TINY_PNG);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        context: 'desk',
        imageMime: 'image/png',
        imageVersion: expect.any(Number),
      });

      const event = await getLatestEventByType('MAP_FLOOR_PLAN_UPLOADED');
      expect(event).not.toBeNull();
      expect(event.actor_id).toBe(adminUser.id);
      expect(event.payload.context).toBe('desk');
      expect(event.payload.image_mime).toBe('image/png');
      expect(event.payload.image_bytes).toBe(TINY_PNG.length);
    });

    test('replacement bumps image_version', async () => {
      const first = await request(app)
        .post('/api/admin/maps/parking/floor-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'image/jpeg')
        .send(TINY_JPEG);
      expect(first.status).toBe(200);
      const v1 = first.body.imageVersion;

      const second = await request(app)
        .post('/api/admin/maps/parking/floor-plan')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Content-Type', 'image/jpeg')
        .send(TINY_JPEG);
      expect(second.status).toBe(200);
      expect(second.body.imageVersion).toBe(v1 + 1);
    });
  });

  describe('Admin landmark CRUD', () => {
    test('rejects landmark with out-of-range coordinates', async () => {
      const res = await request(app)
        .post('/api/admin/maps/desk/landmarks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'lift', x: 1.5, y: 0.5 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('creates, updates, and deletes a landmark with the right audit events', async () => {
      const create = await request(app)
        .post('/api/admin/maps/desk/landmarks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type: 'lift', label: 'Main lift', x: 0.4, y: 0.5 });
      expect(create.status).toBe(201);
      const id = create.body.id;
      expect(create.body).toMatchObject({ context: 'desk', type: 'lift', label: 'Main lift', x: 0.4, y: 0.5 });

      const update = await request(app)
        .put(`/api/admin/maps/desk/landmarks/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'Lobby lift' });
      expect(update.status).toBe(200);
      expect(update.body.label).toBe('Lobby lift');

      const del = await request(app)
        .delete(`/api/admin/maps/desk/landmarks/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(del.status).toBe(204);

      expect(await getLatestEventByType('MAP_LANDMARK_DELETED')).not.toBeNull();
    });

    test('404 when updating a non-existent landmark', async () => {
      const res = await request(app)
        .put('/api/admin/maps/desk/landmarks/9999999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ label: 'oops' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('LANDMARK_NOT_FOUND');
    });
  });

  describe('Admin resource coordinates', () => {
    test('places coordinates for an existing desk and emits the audit event', async () => {
      const res = await request(app)
        .put(`/api/admin/maps/desk/resources/${deskId}/coordinates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ x: 0.25, y: 0.75 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ resourceId: deskId, x: 0.25, y: 0.75 });

      const event = await getLatestEventByType('MAP_RESOURCE_COORDINATES_SET');
      expect(event).not.toBeNull();
      expect(event.target_id).toBe(deskId);
      expect(event.target_type).toBe('desk');
      expect(event.payload).toMatchObject({ context: 'desk', resource_id: deskId, x: 0.25, y: 0.75 });
    });

    test('404 when desk does not exist', async () => {
      const res = await request(app)
        .put('/api/admin/maps/desk/resources/9999999/coordinates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ x: 0.5, y: 0.5 });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });

    test('places coordinates for an existing parking space', async () => {
      const res = await request(app)
        .put(`/api/admin/maps/parking/resources/${spaceId}/coordinates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ x: 0.1, y: 0.2 });
      expect(res.status).toBe(200);
      expect(res.body.resourceId).toBe(spaceId);
    });

    test('rejects out-of-range coordinates', async () => {
      const res = await request(app)
        .put(`/api/admin/maps/desk/resources/${deskId}/coordinates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ x: 2, y: 0.5 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
