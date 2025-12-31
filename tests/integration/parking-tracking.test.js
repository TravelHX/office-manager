const request = require('supertest');
const app = require('../../src/backend/server');

describe('Parking Tracking API Integration Tests', () => {
  const authToken = 'Bearer test_user_123';

  describe('GET /api/parking-spaces', () => {
    test('should return list of parking spaces', async () => {
      const response = await request(app)
        .get('/api/parking-spaces')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/parking-spaces/available', () => {
    test('should return available parking spaces for date and time period', async () => {
      const reservationDate = '2025-12-15';
      const timePeriod = 'morning';

      const response = await request(app)
        .get(`/api/parking-spaces/available?reservationDate=${reservationDate}&timePeriod=${timePeriod}`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    test('should return 400 when date or time period are missing', async () => {
      const response = await request(app)
        .get('/api/parking-spaces/available')
        .set('Authorization', authToken);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARAMS');
    });

    test('should return 400 when time period is invalid', async () => {
      const response = await request(app)
        .get('/api/parking-spaces/available?reservationDate=2025-12-15&timePeriod=invalid')
        .set('Authorization', authToken);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TIME_PERIOD');
    });
  });

  describe('POST /api/parking-reservations', () => {
    test('should return 400 when required fields are missing', async () => {
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', authToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    test('should return 400 when time period is invalid', async () => {
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', authToken)
        .send({
          parkingSpaceId: 1,
          reservationDate: '2025-12-15',
          timePeriod: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TIME_PERIOD');
    });
  });

  describe('GET /api/parking-reservations/my-reservations', () => {
    test('should return user reservations', async () => {
      const response = await request(app)
        .get('/api/parking-reservations/my-reservations')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('GET /api/parking-reservations/check-availability', () => {
    test('should return 400 when required parameters are missing', async () => {
      const response = await request(app)
        .get('/api/parking-reservations/check-availability')
        .set('Authorization', authToken);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });
  });
});

