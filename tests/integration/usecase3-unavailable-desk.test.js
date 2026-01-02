/**
 * Use Case 3: Employee Attempts to Book Unavailable Desk
 * 
 * This test validates the error handling when:
 * 1. All desks are booked for a specific date/time
 * 2. System displays appropriate error message
 * 3. System handles unavailable desk scenarios gracefully
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const DeskService = require('../../src/backend/services/DeskService');
const BookingService = require('../../src/backend/services/BookingService');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');

describe('Use Case 3: Employee Attempts to Book Unavailable Desk', () => {
  let deskService;
  let bookingService;
  let deskRepository;
  let bookingRepository;
  let testDesks = [];
  let userTokens = [];
  const testDate = '2026-12-20';

  beforeAll(async () => {
    deskService = new DeskService();
    bookingService = new BookingService();
    deskRepository = new DeskRepository();
    bookingRepository = new BookingRepository();

    // Create multiple test desks
    for (let i = 1; i <= 3; i++) {
      const desk = await deskService.createDesk({
        deskNumber: `UC3-D00${i}`,
        location: `Floor 1 - Test Area ${i}`,
        description: `Test desk ${i} for Use Case 3`,
        isActive: true,
      });
      testDesks.push(desk.id);
    }

    // Create tokens for multiple users
    for (let i = 1; i <= 4; i++) {
      userTokens.push(`Bearer user_200${i}`);
    }
  });

  afterAll(async () => {
    // Cleanup: Delete test bookings and desks
    try {
      const bookings = await bookingRepository.findAll();
      for (const booking of bookings) {
        if (testDesks.includes(booking.deskId)) {
          await bookingRepository.delete(booking.id);
        }
      }
      for (const deskId of testDesks) {
        await deskRepository.delete(deskId);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('Step 1-3: Book all available desks for a specific date', async () => {
    // Book all 3 desks for the test date
    for (let i = 0; i < testDesks.length; i++) {
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', userTokens[i])
        .send({
          deskId: testDesks[i],
          startDate: testDate,
          endDate: testDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.deskId).toBe(testDesks[i]);
      expect(response.body.startDate).toBe(testDate);
      expect(response.body.endDate).toBe(testDate);
    }
  });

  test('Step 4-6: New user sees no desks available for the booked date', async () => {
    const newUserToken = userTokens[3];

    const response = await request(app)
      .get(`/api/bookings/available?startDate=${testDate}&endDate=${testDate}`)
      .set('Authorization', newUserToken);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    // None of the test desks should be available
    const availableDeskIds = response.body.map(d => d.id);
    testDesks.forEach(deskId => {
      expect(availableDeskIds).not.toContain(deskId);
    });
  });

  test('Step 7-8: Appropriate error message when trying to book unavailable desk', async () => {
    const newUserToken = userTokens[3];

    // Try to book one of the already-booked desks
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', newUserToken)
      .send({
        deskId: testDesks[0],
        startDate: testDate,
        endDate: testDate,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('DESK_UNAVAILABLE');
    expect(response.body.error.message).toMatch(/not available|unavailable/i);
  });

  test('Step 9: Desks are available for different dates', async () => {
    const differentDate = '2026-12-25';
    const newUserToken = userTokens[3];

    const response = await request(app)
      .get(`/api/bookings/available?startDate=${differentDate}&endDate=${differentDate}`)
      .set('Authorization', newUserToken);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    // All test desks should be available for different dates
    const availableDeskIds = response.body.map(d => d.id);
    testDesks.forEach(deskId => {
      expect(availableDeskIds).toContain(deskId);
    });
  });

  test('Availability check API returns empty array with appropriate status', async () => {
    const newUserToken = userTokens[3];

    const response = await request(app)
      .get(`/api/bookings/available?startDate=${testDate}&endDate=${testDate}`)
      .set('Authorization', newUserToken);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    // The response should be an empty array (or not contain our test desks)
    const availableDeskIds = response.body.map(d => d.id);
    const testDesksInResponse = testDesks.filter(id => availableDeskIds.includes(id));
    expect(testDesksInResponse.length).toBe(0);
  });

  test('Check availability endpoint handles date range correctly', async () => {
    const newUserToken = userTokens[3];
    
    // Check overlapping date range (includes the booked date)
    const overlappingStart = '2026-12-19';
    const overlappingEnd = '2026-12-21';

    const response = await request(app)
      .get(`/api/bookings/available?startDate=${overlappingStart}&endDate=${overlappingEnd}`)
      .set('Authorization', newUserToken);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    // Desks should not be available due to overlap
    const availableDeskIds = response.body.map(d => d.id);
    testDesks.forEach(deskId => {
      expect(availableDeskIds).not.toContain(deskId);
    });
  });

  test('Error message is clear and actionable', async () => {
    const newUserToken = userTokens[3];

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', newUserToken)
      .send({
        deskId: testDesks[0],
        startDate: testDate,
        endDate: testDate,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('DESK_UNAVAILABLE');
    expect(response.body.error.message).toBeTruthy();
    expect(typeof response.body.error.message).toBe('string');
    expect(response.body.error.message.length).toBeGreaterThan(0);
  });
});

