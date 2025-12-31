/**
 * Use Case 2: Employee Books Desk and Parking Space for Half Day
 * 
 * This test validates the complete workflow:
 * 1. Employee selects date and time period (morning or afternoon)
 * 2. Employee views available desks for the selected date and time period
 * 3. Employee books a desk
 * 4. Employee views available parking spaces for the same date and time period
 * 5. Employee reserves a parking space
 * 6. System validates both bookings
 * 7. Both resources become unavailable for other employees
 */

const request = require('supertest');
const app = require('../../src/backend/server');
const DeskService = require('../../src/backend/services/DeskService');
const BookingService = require('../../src/backend/services/BookingService');
const ParkingSpaceService = require('../../src/backend/services/ParkingSpaceService');
const ParkingReservationService = require('../../src/backend/services/ParkingReservationService');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');

describe('Use Case 2: Employee Books Desk and Parking Space for Half Day', () => {
  let deskService;
  let bookingService;
  let parkingSpaceService;
  let reservationService;
  let deskRepository;
  let bookingRepository;
  let parkingSpaceRepository;
  let reservationRepository;
  let testDeskId;
  let testParkingSpaceId;
  let user1Token;
  let user2Token;

  beforeAll(async () => {
    deskService = new DeskService();
    bookingService = new BookingService();
    parkingSpaceService = new ParkingSpaceService();
    reservationService = new ParkingReservationService();
    deskRepository = new DeskRepository();
    bookingRepository = new BookingRepository();
    parkingSpaceRepository = new ParkingSpaceRepository();
    reservationRepository = new ParkingReservationRepository();

    // Create a test desk
    const desk = await deskService.createDesk({
      deskNumber: 'UC2-D001',
      location: 'Floor 1 - Test Area',
      description: 'Test desk for Use Case 2',
      isActive: true,
    });
    testDeskId = desk.id;

    // Create a test parking space
    const parkingSpace = await parkingSpaceService.createParkingSpace({
      spaceNumber: 'UC2-P001',
      location: 'Lot A - Test Area',
      description: 'Test parking space for Use Case 2',
      isActive: true,
    });
    testParkingSpaceId = parkingSpace.id;

    // Create tokens for two different users
    user1Token = 'Bearer user_2001';
    user2Token = 'Bearer user_2002';
  });

  afterAll(async () => {
    // Cleanup: Delete test bookings, reservations, desk, and parking space
    try {
      const bookings = await bookingRepository.findAll();
      for (const booking of bookings) {
        if (booking.deskId === testDeskId) {
          await bookingRepository.delete(booking.id);
        }
      }
      
      const reservations = await reservationRepository.findAll();
      for (const reservation of reservations) {
        if (reservation.parkingSpaceId === testParkingSpaceId) {
          await reservationRepository.delete(reservation.id);
        }
      }
      
      await deskRepository.delete(testDeskId);
      await parkingSpaceRepository.delete(testParkingSpaceId);
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  });

  test('Step 1-2: User can view available desks for a specific date', async () => {
    const reservationDate = '2025-12-15';
    const startDate = reservationDate;
    const endDate = reservationDate;

    const response = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user1Token);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    const testDesk = response.body.find(d => d.id === testDeskId);
    expect(testDesk).toBeDefined();
    expect(testDesk.deskNumber).toBe('UC2-D001');
  });

  test('Step 3: User can book a desk for a specific date', async () => {
    const reservationDate = '2025-12-15';
    const startDate = reservationDate;
    const endDate = reservationDate;

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

  test('Step 4: User can view available parking spaces for the same date and time period', async () => {
    const reservationDate = '2025-12-15';
    const timePeriod = 'morning';

    const response = await request(app)
      .get(`/api/parking-spaces/available?reservationDate=${reservationDate}&timePeriod=${timePeriod}`)
      .set('Authorization', user1Token);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    const testSpace = response.body.find(ps => ps.id === testParkingSpaceId);
    expect(testSpace).toBeDefined();
    expect(testSpace.spaceNumber).toBe('UC2-P001');
  });

  test('Step 5: User can reserve a parking space for the same date and time period', async () => {
    const reservationDate = '2025-12-15';
    const timePeriod = 'morning';

    const response = await request(app)
      .post('/api/parking-reservations')
      .set('Authorization', user1Token)
      .send({
        parkingSpaceId: testParkingSpaceId,
        reservationDate: reservationDate,
        timePeriod: timePeriod,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.parkingSpaceId).toBe(testParkingSpaceId);
    expect(response.body.reservationDate).toBe(reservationDate);
    expect(response.body.timePeriod).toBe(timePeriod);
    expect(response.body.status).toBe('active');
  });

  test('Step 6-7: Both resources become unavailable for other employees', async () => {
    const reservationDate = '2025-12-15';
    const timePeriod = 'morning';
    const startDate = reservationDate;
    const endDate = reservationDate;

    // Check desk availability for another user
    const deskAvailabilityResponse = await request(app)
      .get(`/api/bookings/available?startDate=${startDate}&endDate=${endDate}`)
      .set('Authorization', user2Token);

    expect(deskAvailabilityResponse.status).toBe(200);
    const testDeskAvailable = deskAvailabilityResponse.body.find(d => d.id === testDeskId);
    expect(testDeskAvailable).toBeUndefined(); // Desk should not be available

    // Check parking space availability for another user
    const parkingAvailabilityResponse = await request(app)
      .get(`/api/parking-spaces/available?reservationDate=${reservationDate}&timePeriod=${timePeriod}`)
      .set('Authorization', user2Token);

    expect(parkingAvailabilityResponse.status).toBe(200);
    const testSpaceAvailable = parkingAvailabilityResponse.body.find(ps => ps.id === testParkingSpaceId);
    expect(testSpaceAvailable).toBeUndefined(); // Parking space should not be available
  });

  test('User can view both bookings in My Bookings', async () => {
    const bookingsResponse = await request(app)
      .get('/api/bookings/my-bookings')
      .set('Authorization', user1Token);

    expect(bookingsResponse.status).toBe(200);
    expect(Array.isArray(bookingsResponse.body)).toBe(true);
    const userBooking = bookingsResponse.body.find(b => b.deskId === testDeskId);
    expect(userBooking).toBeDefined();

    const reservationsResponse = await request(app)
      .get('/api/parking-reservations/my-reservations')
      .set('Authorization', user1Token);

    expect(reservationsResponse.status).toBe(200);
    expect(Array.isArray(reservationsResponse.body)).toBe(true);
    const userReservation = reservationsResponse.body.find(r => r.parkingSpaceId === testParkingSpaceId);
    expect(userReservation).toBeDefined();
  });
});

