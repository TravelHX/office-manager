const request = require('supertest');
const app = require('../../src/backend/server');

describe('Desk Booking API Integration Tests', () => {
  const authToken = 'Bearer test_user_123';

  describe('GET /api/desks', () => {
    test('should return list of desks', async () => {
      const response = await request(app)
        .get('/api/desks')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/bookings/available', () => {
    test('should return available desks for date range', async () => {
      const startDate = '2025-12-15';
      const endDate = '2025-12-16';

      const response = await request(app)
        .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 400 when dates are missing', async () => {
      const response = await request(app)
        .get('/api/bookings/available')
        .set('Authorization', authToken);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_DATES');
    });

    test('should not return 404 for /api/bookings/available route', async () => {
      // This test reproduces bug 0001 - the route should not return 404
      const startDate = '2025-12-15';
      const endDate = '2025-12-16';

      const response = await request(app)
        .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', authToken);

      // The route should be found (not 404)
      expect(response.status).not.toBe(404);
      expect(response.body.error?.code).not.toBe('NOT_FOUND');
    });
  });

  describe('POST /api/bookings', () => {
    test('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });
  });

  describe('GET /api/bookings/my-bookings', () => {
    test('should return user bookings', async () => {
      const response = await request(app)
        .get('/api/bookings/my-bookings')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});

