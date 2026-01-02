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

  describe('Bug 0003: Desk booking not showing in admin', () => {
    test('should show created booking in admin dashboard', async () => {
      const adminToken = 'Bearer admin_1';
      const userToken = 'Bearer user_1';
      
      // First, create a booking
      const createResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId: 1,
          startDate: '2025-12-20',
          endDate: '2025-12-21',
        });

      expect(createResponse.status).toBe(201);
      const createdBooking = createResponse.body;
      expect(createdBooking).toHaveProperty('id');

      // Then, check if it appears in admin dashboard
      const adminResponse = await request(app)
        .get('/api/admin/bookings')
        .set('Authorization', adminToken);

      expect(adminResponse.status).toBe(200);
      expect(Array.isArray(adminResponse.body)).toBe(true);
      
      // The created booking should be in the list
      const bookingInList = adminResponse.body.find(b => b.id === createdBooking.id);
      expect(bookingInList).toBeDefined();
      expect(bookingInList.deskId).toBe(createdBooking.deskId);
    });
  });

  describe('Bug 0004: No duplicate desk booking validation', () => {
    test('should prevent creating duplicate bookings for same desk and dates', async () => {
      const userToken = 'Bearer user_1';
      const deskId = 1;
      const startDate = '2025-12-22';
      const endDate = '2025-12-23';

      // Create first booking
      const firstResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({ deskId, startDate, endDate });

      expect(firstResponse.status).toBe(201);

      // Try to create duplicate booking
      const duplicateResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({ deskId, startDate, endDate });

      // Should be rejected
      expect(duplicateResponse.status).toBe(400);
      expect(duplicateResponse.body.error.code).toBe('DESK_UNAVAILABLE');
      expect(duplicateResponse.body.error.message).toContain('not available');
    });
  });

  describe('Bug 0005: No overlapping desk booking validation', () => {
    test('should prevent creating overlapping bookings for same desk', async () => {
      const userToken = 'Bearer user_1';
      const deskId = 1;

      // Create first booking
      const firstResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId,
          startDate: '2025-12-24',
          endDate: '2025-12-26',
        });

      expect(firstResponse.status).toBe(201);

      // Try to create overlapping booking (overlaps at start)
      const overlapStartResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId,
          startDate: '2025-12-23',
          endDate: '2025-12-25',
        });

      expect(overlapStartResponse.status).toBe(400);
      expect(overlapStartResponse.body.error.code).toBe('DESK_UNAVAILABLE');

      // Try to create overlapping booking (overlaps at end)
      const overlapEndResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId,
          startDate: '2025-12-25',
          endDate: '2025-12-27',
        });

      expect(overlapEndResponse.status).toBe(400);
      expect(overlapEndResponse.body.error.code).toBe('DESK_UNAVAILABLE');

      // Try to create overlapping booking (completely within)
      const withinResponse = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId,
          startDate: '2025-12-25',
          endDate: '2025-12-25',
        });

      expect(withinResponse.status).toBe(400);
      expect(withinResponse.body.error.code).toBe('DESK_UNAVAILABLE');
    });
  });
});

