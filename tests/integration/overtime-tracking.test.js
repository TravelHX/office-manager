const request = require('supertest');
const app = require('../../src/backend/server');

describe('Overtime Tracking API Integration Tests', () => {
  const authToken = 'Bearer test_user_123';

  describe('GET /api/overtime/my-overtime', () => {
    test('should return user overtime records', async () => {
      const response = await request(app)
        .get('/api/overtime/my-overtime')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('POST /api/overtime', () => {
    test('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/overtime')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    test('should return 400 when end time is before start time', async () => {
      const response = await request(app)
        .post('/api/overtime')
        .set('Authorization', authToken)
        .send({
          recordDate: '2025-12-15',
          startTime: '18:00:00',
          endTime: '17:00:00',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('GET /api/overtime/history', () => {
    test('should return 400 when dates are missing', async () => {
      const response = await request(app)
        .get('/api/overtime/history')
        .set('Authorization', authToken);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_DATES');
    });
  });

  describe('GET /api/overtime/report', () => {
    test('should return 400 when dates are missing', async () => {
      const response = await request(app)
        .get('/api/overtime/report')
        .set('Authorization', authToken);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_DATES');
    });
  });
});

