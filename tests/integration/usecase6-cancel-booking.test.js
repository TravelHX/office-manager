/**
 * Use Case 6: User Cancels Their Own Desk Booking
 * 
 * This test validates the complete workflow:
 * 1. Employee views their bookings
 * 2. Employee selects a booking to cancel
 * 3. Employee confirms cancellation
 * 4. System cancels the booking and frees up the desk
 * 5. Desk becomes available for other employees
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const DeskService = require('../../src/backend/services/DeskService');
const BookingService = require('../../src/backend/services/BookingService');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');

describe('Use Case 6: User Cancels Their Own Desk Booking', () => {
  let deskService;
  let bookingService;
  let deskRepository;
  let bookingRepository;
  let testDeskId;
  let user1Token;
  let user2Token;
  let bookingId;

  beforeAll(async () => {
    deskService = new DeskService();
    bookingService = new BookingService();
    deskRepository = new DeskRepository();
    bookingRepository = new BookingRepository();

    // Create a test desk
    const desk = await deskService.createDesk({
      deskNumber: 'UC6-D001',
      location: 'Floor 1 - Test Area',
      description: 'Test desk for Use Case 6',
      isActive: true,
    });
    testDeskId = desk.id;

    // Create tokens for two different users
    user1Token = 'Bearer user_3001';
    user2Token = 'Bearer user_3002';
  });

  beforeEach(async () => {
    // Create a booking for user1 before each test
    const booking = await bookingService.createBooking(
      3001, // user1 ID
      testDeskId,
      '2025-12-25',
      '2025-12-26'
    );
    bookingId = booking.id;
  });

  afterEach(async () => {
    // Cleanup: Cancel any remaining bookings
    try {
      const bookings = await bookingRepository.findAll();
      for (const booking of bookings) {
        if (booking.deskId === testDeskId && booking.status === 'active') {
          await bookingRepository.cancel(booking.id, booking.userId, 'Test cleanup');
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
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

  test('Step 1-2: User can view their bookings', async () => {
    const response = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', user1Token);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    const booking = response.body.find(b => b.id === bookingId);
    expect(booking).toBeDefined();
    expect(booking.deskId).toBe(testDeskId);
    expect(booking.status).toBe('active');
  });

  test('Step 3-4: User can cancel their own booking', async () => {
    const response = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    expect(response.status).toBe(204);
  });

  test('Step 4: Cancelled booking is marked as cancelled', async () => {
    // Cancel the booking
    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    // Verify booking status
    const bookingResponse = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    expect(bookingResponse.status).toBe(200);
    expect(bookingResponse.body.status).toBe('cancelled');
    expect(bookingResponse.body.cancelledAt).toBeTruthy();
  });

  test('Step 5: Desk becomes available after cancellation', async () => {
    const startDate = '2025-12-25';
    const endDate = '2025-12-26';

    // Verify desk is not available before cancellation
    const beforeResponse = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user2Token);

    const availableBefore = beforeResponse.body.find(d => d.id === testDeskId);
    expect(availableBefore).toBeUndefined();

    // Cancel the booking
    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    // Verify desk is now available
    const afterResponse = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user2Token);

    expect(afterResponse.status).toBe(200);
    const availableAfter = afterResponse.body.find(d => d.id === testDeskId);
    expect(availableAfter).toBeDefined();
    expect(availableAfter.id).toBe(testDeskId);
  });

  test('Step 5: Another user can book the desk after cancellation', async () => {
    const startDate = '2025-12-25';
    const endDate = '2025-12-26';

    // Cancel user1's booking
    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    // User2 can now book the desk
    const bookingResponse = await request(app)
      .post('/api/bookings')
      .set('Authorization', user2Token)
      .send({
        deskId: testDeskId,
        startDate: startDate,
        endDate: endDate,
      });

    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.deskId).toBe(testDeskId);
    expect(bookingResponse.body.startDate).toBe(startDate);
    expect(bookingResponse.body.endDate).toBe(endDate);
    expect(bookingResponse.body.status).toBe('active');
  });

  test('Cancelled booking is removed from or marked in My Bookings', async () => {
    // Cancel the booking
    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    // Check My Bookings
    const bookingsResponse = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', user1Token);

    expect(bookingsResponse.status).toBe(200);
    
    const cancelledBooking = bookingsResponse.body.find(b => b.id === bookingId);
    expect(cancelledBooking).toBeDefined();
    expect(cancelledBooking.status).toBe('cancelled');
  });

  test('User cannot cancel another user\'s booking', async () => {
    // User2 tries to cancel user1's booking
    const response = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user2Token);

    expect(response.status).toBe(403);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toMatch(/only cancel your own|own bookings/i);
  });

  test('User cannot cancel already cancelled booking', async () => {
    // Cancel the booking first
    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    // Try to cancel again
    const response = await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    expect(response.status).toBe(400);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.code).toBe('ALREADY_CANCELLED');
  });

  test('Cancellation frees up desk for overlapping date ranges', async () => {
    const startDate = '2025-12-24';
    const endDate = '2025-12-27'; // Overlaps with booking

    // Cancel the booking
    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    // Check availability for overlapping range
    const response = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user2Token);

    expect(response.status).toBe(200);
    const availableDesk = response.body.find(d => d.id === testDeskId);
    expect(availableDesk).toBeDefined();
  });

  test('Booking details are preserved after cancellation', async () => {
    // Cancel the booking
    await request(app)
      .delete(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    // Verify booking details are preserved
    const bookingResponse = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', user1Token);

    expect(bookingResponse.status).toBe(200);
    expect(bookingResponse.body.id).toBe(bookingId);
    expect(bookingResponse.body.deskId).toBe(testDeskId);
    expect(bookingResponse.body.startDate).toBe('2025-12-25');
    expect(bookingResponse.body.endDate).toBe('2025-12-26');
    expect(bookingResponse.body.status).toBe('cancelled');
    expect(bookingResponse.body.cancelledAt).toBeTruthy();
  });
});

