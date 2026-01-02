/**
 * Use Case 5: Admin Cancels User Desk Booking
 * 
 * This test validates the complete workflow:
 * 1. User creates a desk booking
 * 2. Admin views all bookings
 * 3. Admin cancels the user's booking with reason
 * 4. Booking is cancelled and desk becomes available
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const DeskService = require('../../src/backend/services/DeskService');
const BookingService = require('../../src/backend/services/BookingService');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');

describe('Use Case 5: Admin Cancels User Desk Booking', () => {
  let deskService;
  let bookingService;
  let deskRepository;
  let bookingRepository;
  let testDeskId;
  let userToken;
  let adminToken;

  beforeAll(async () => {
    deskService = new DeskService();
    bookingService = new BookingService();
    deskRepository = new DeskRepository();
    bookingRepository = new BookingRepository();

    const desk = await deskService.createDesk({
      deskNumber: 'UC5-D001',
      location: 'Floor 1 - Test Area',
      description: 'Test desk for Use Case 5',
      isActive: true,
    });
    testDeskId = desk.id;

    userToken = 'Bearer user_5001';
    adminToken = 'Bearer admin_5001';
  });

  afterAll(async () => {
    // Cleanup
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

  test('Step 1: User creates a desk booking', async () => {
    const bookingDate = '2026-12-20';

    const response = await request(app)
      .post('/api/bookings')
      .set('Authorization', userToken)
      .send({
        deskId: testDeskId,
        startDate: bookingDate,
        endDate: bookingDate,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.deskId).toBe(testDeskId);
    expect(response.body.status).toBe('active');
  });

  test('Step 2-3: Admin views all bookings', async () => {
    const response = await request(app)
      .get('/api/admin/bookings')
      .set('Authorization', adminToken);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    const testBooking = response.body.find(b => b.deskId === testDeskId);
    expect(testBooking).toBeDefined();
    expect(testBooking.status).toBe('active');
  });

  test('Step 4-8: Admin cancels user booking with reason', async () => {
    const bookingsResponse = await request(app)
      .get('/api/admin/bookings')
      .set('Authorization', adminToken);

    const testBooking = bookingsResponse.body.find(b => b.deskId === testDeskId && b.status === 'active');
    expect(testBooking).toBeDefined();

    const cancellationReason = 'Administrative cancellation - policy violation';

    const cancelResponse = await request(app)
      .delete(`/api/admin/bookings/${testBooking.id}`)
      .set('Authorization', adminToken)
      .send({ reason: cancellationReason });

    expect(cancelResponse.status).toBe(204);
  });

  test('Step 9-11: Booking is cancelled and desk becomes available', async () => {
    const bookingsResponse = await request(app)
      .get('/api/admin/bookings')
      .set('Authorization', adminToken);

    const cancelledBooking = bookingsResponse.body.find(b => b.deskId === testDeskId);
    expect(cancelledBooking).toBeDefined();
    expect(cancelledBooking.status).toBe('cancelled');

    const bookingDate = '2026-12-20';
    const availabilityResponse = await request(app)
      .get(`/api/bookings/available?startDate=${bookingDate}&endDate=${bookingDate}`)
      .set('Authorization', userToken);

    expect(availabilityResponse.status).toBe(200);
    const availableDesk = availabilityResponse.body.find(d => d.id === testDeskId);
    expect(availableDesk).toBeDefined();
  });

  test('Step 12-15: User sees cancelled booking in My Bookings', async () => {
    const userBookingsResponse = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', userToken);

    expect(userBookingsResponse.status).toBe(200);
    const userBooking = userBookingsResponse.body.find(b => b.deskId === testDeskId);
    expect(userBooking).toBeDefined();
    expect(userBooking.status).toBe('cancelled');
  });
});

