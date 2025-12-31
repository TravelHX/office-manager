/**
 * Use Case 1: Employee Books Desk for Two Days
 * 
 * This test validates the complete workflow:
 * 1. Employee selects date range (two consecutive days)
 * 2. Employee views available desks
 * 3. Employee books a desk
 * 4. System validates and creates booking
 * 5. Desk becomes unavailable for other employees
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const DeskService = require('../../src/backend/services/DeskService');
const BookingService = require('../../src/backend/services/BookingService');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');

describe('Use Case 1: Employee Books Desk for Two Days', () => {
  let deskService;
  let bookingService;
  let deskRepository;
  let bookingRepository;
  let testDeskId;
  let user1Token;
  let user2Token;

  beforeAll(async () => {
    deskService = new DeskService();
    bookingService = new BookingService();
    deskRepository = new DeskRepository();
    bookingRepository = new BookingRepository();

    // Create a test desk
    const desk = await deskService.createDesk({
      deskNumber: 'UC1-D001',
      location: 'Floor 1 - Test Area',
      description: 'Test desk for Use Case 1',
      isActive: true,
    });
    testDeskId = desk.id;

    // Create tokens for two different users
    user1Token = 'Bearer user_1001';
    user2Token = 'Bearer user_1002';
  });

  afterAll(async () => {
    // Cleanup: Delete test bookings and desk
    try {
      const bookings = await bookingRepository.findAll();
      for (const booking of bookings) {
        if (booking.deskId === testDeskId) {
          await bookingRepository.delete(booking.id);
        }
      }
      await deskRepository.delete(testDeskId);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('Step 1-4: User can view available desks for a two-day date range', async () => {
    const startDate = '2025-12-15';
    const endDate = '2025-12-16';

    const response = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user1Token);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    const testDesk = response.body.find(d => d.id === testDeskId);
    expect(testDesk).toBeDefined();
    expect(testDesk.deskNumber).toBe('UC1-D001');
  });

  test('Step 5-8: User can book a desk for two consecutive days', async () => {
    const startDate = '2025-12-15';
    const endDate = '2025-12-16';

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', user1Token)
      .send({
        deskId: testDeskId,
        startDate: startDate,
        endDate: endDate,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.deskId).toBe(testDeskId);
    expect(response.body.startDate).toBe(startDate);
    expect(response.body.endDate).toBe(endDate);
    expect(response.body.status).toBe('active');
  });

  test('Step 9-10: Booking appears in user bookings', async () => {
    const response = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', user1Token);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    const booking = response.body.find(b => b.deskId === testDeskId);
    expect(booking).toBeDefined();
    expect(booking.startDate).toBe('2025-12-15');
    expect(booking.endDate).toBe('2025-12-16');
    expect(booking.status).toBe('active');
  });

  test('Step 11: Desk becomes unavailable for other employees', async () => {
    const startDate = '2025-12-15';
    const endDate = '2025-12-16';

    // User 2 tries to check availability for the same dates
    const availabilityResponse = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user2Token);

    expect(availabilityResponse.status).toBe(200);
    
    // The desk should NOT be in the available list
    const testDesk = availabilityResponse.body.find(d => d.id === testDeskId);
    expect(testDesk).toBeUndefined();
  });

  test('Step 11: Other user cannot book the same desk for overlapping dates', async () => {
    const startDate = '2025-12-15';
    const endDate = '2025-12-16';

    // User 2 tries to book the same desk
    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', user2Token)
      .send({
        deskId: testDeskId,
        startDate: startDate,
        endDate: endDate,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.message).toMatch(/not available|unavailable/i);
  });

  test('Desk is available for different dates', async () => {
    const startDate = '2025-12-20';
    const endDate = '2025-12-21';

    const response = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user2Token);

    expect(response.status).toBe(200);
    
    // The desk should be available for different dates
    const testDesk = response.body.find(d => d.id === testDeskId);
    expect(testDesk).toBeDefined();
  });
});

