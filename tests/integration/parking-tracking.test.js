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

  describe('POST /api/parking-reservations/bulk - Multi-select parking reservation', () => {
    test('should create multiple reservations successfully', async () => {
      const userToken = 'Bearer user_1';
      const parkingSpaceIds = [1, 2, 3];
      const reservationDate = '2025-12-28';
      const timePeriod = 'morning';

      const response = await request(app)
        .post('/api/parking-reservations/bulk')
        .set('Authorization', userToken)
        .send({ parkingSpaceIds, reservationDate, timePeriod });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(response.body).toHaveProperty('errors');
      expect(Array.isArray(response.body.successful)).toBe(true);
      expect(response.body.successful.length).toBeGreaterThan(0);
    });

    test('should return 400 when parkingSpaceIds is empty', async () => {
      const userToken = 'Bearer user_1';

      const response = await request(app)
        .post('/api/parking-reservations/bulk')
        .set('Authorization', userToken)
        .send({ parkingSpaceIds: [], reservationDate: '2025-12-28', timePeriod: 'morning' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARKING_SPACE_IDS');
    });

    test('should return 400 when reservationDate or timePeriod are missing', async () => {
      const userToken = 'Bearer user_1';

      const response = await request(app)
        .post('/api/parking-reservations/bulk')
        .set('Authorization', userToken)
        .send({ parkingSpaceIds: [1, 2] });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_PARAMETERS');
    });

    test('should return 400 when timePeriod is invalid', async () => {
      const userToken = 'Bearer user_1';

      const response = await request(app)
        .post('/api/parking-reservations/bulk')
        .set('Authorization', userToken)
        .send({
          parkingSpaceIds: [1, 2],
          reservationDate: '2025-12-28',
          timePeriod: 'invalid',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_TIME_PERIOD');
    });

    test('should handle partial failures in bulk reservations', async () => {
      const userToken = 'Bearer user_1';
      const parkingSpaceIds = [999, 998]; // Non-existent spaces
      const reservationDate = '2025-12-30';
      const timePeriod = 'morning';

      const response = await request(app)
        .post('/api/parking-reservations/bulk')
        .set('Authorization', userToken)
        .send({ parkingSpaceIds, reservationDate, timePeriod });

      // Should return 400 if all fail, or 207 if partial success
      expect([400, 207]).toContain(response.status);
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
    });

    test('should prevent bulk reservation when user has overlapping reservation', async () => {
      const userToken = 'Bearer user_1';
      
      // Create an existing reservation first
      await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', userToken)
        .send({
          parkingSpaceId: 1,
          reservationDate: '2026-01-01',
          timePeriod: 'morning',
        });

      // Try to bulk reserve spaces for overlapping date and time period
      const response = await request(app)
        .post('/api/parking-reservations/bulk')
        .set('Authorization', userToken)
        .send({
          parkingSpaceIds: [2, 3],
          reservationDate: '2026-01-01',
          timePeriod: 'morning',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('OVERLAPPING_RESERVATION');
    });
  });
});

