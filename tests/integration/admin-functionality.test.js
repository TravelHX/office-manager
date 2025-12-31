const request = require('supertest');
const app = require('../../src/backend/server');

describe('Admin Functionality API Integration Tests', () => {
  const adminToken = 'Bearer admin_1';
  const userToken = 'Bearer user_1';

  describe('GET /api/admin/configuration', () => {
    test('should return configuration for admin', async () => {
      const response = await request(app)
        .get('/api/admin/configuration')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('deskCount');
      expect(response.body).toHaveProperty('parkingCount');
    });

    test('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .get('/api/admin/configuration')
        .set('Authorization', userToken);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('PUT /api/admin/configuration/desk-count', () => {
    test('should return 400 when desk count is missing', async () => {
      const response = await request(app)
        .put('/api/admin/configuration/desk-count')
        .set('Authorization', adminToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_DESK_COUNT');
    });

    test('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .put('/api/admin/configuration/desk-count')
        .set('Authorization', userToken)
        .send({ deskCount: 10 });

      expect(response.status).toBe(403);
    });
  });

  describe('PUT /api/admin/configuration/parking-count', () => {
    test('should return 400 when parking count is missing', async () => {
      const response = await request(app)
        .put('/api/admin/configuration/parking-count')
        .set('Authorization', adminToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARKING_COUNT');
    });
  });

  describe('GET /api/admin/bookings', () => {
    test('should return all bookings for admin', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', userToken);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/parking-reservations', () => {
    test('should return all parking reservations for admin', async () => {
      const response = await request(app)
        .get('/api/admin/parking-reservations')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/admin/overtime-records', () => {
    test('should return all overtime records for admin', async () => {
      const response = await request(app)
        .get('/api/admin/overtime-records')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('DELETE /api/admin/bookings/:id', () => {
    test('should return 404 when booking not found', async () => {
      const response = await request(app)
        .delete('/api/admin/bookings/99999')
        .set('Authorization', adminToken)
        .send({ reason: 'Test cancellation' });

      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('BOOKING_NOT_FOUND');
    });

    test('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .delete('/api/admin/bookings/1')
        .set('Authorization', userToken);

      expect(response.status).toBe(403);
    });
  });
});

