const request = require('supertest');
const app = require('../../src/backend/server');
const UserService = require('../../src/backend/services/UserService');
const BookingService = require('../../src/backend/services/BookingService');
const ParkingReservationService = require('../../src/backend/services/ParkingReservationService');
const DeskService = require('../../src/backend/services/DeskService');
const ParkingSpaceService = require('../../src/backend/services/ParkingSpaceService');
const { generateToken } = require('../../src/backend/utils/token');

describe('Matrix API Integration Tests', () => {
  let adminToken;
  let userToken;
  let adminUser;
  let regularUser;
  let desk1, desk2;
  let parkingSpace1, parkingSpace2;
  let booking1, booking2;
  let reservation1, reservation2;

  beforeAll(async () => {
    const userService = new UserService();
    
    // Create admin user
    try {
      adminUser = await userService.createUser({
        username: 'matrixadmin',
        email: 'matrixadmin@test.com',
        password: 'Password123',
        role: 'admin',
      }, 1);
    } catch (error) {
      // User might already exist
      adminUser = await userService.userRepository.findByUsername('matrixadmin');
    }
    adminToken = generateToken(adminUser);

    // Create regular user
    try {
      regularUser = await userService.createUser({
        username: 'matrixuser',
        email: 'matrixuser@test.com',
        password: 'Password123',
        role: 'user',
      }, 2);
    } catch (error) {
      regularUser = await userService.userRepository.findByUsername('matrixuser');
    }
    userToken = generateToken(regularUser);

    // Create desks
    const deskService = new DeskService();
    desk1 = await deskService.createDesk({ deskNumber: 'D001', location: 'Office A', isActive: true });
    desk2 = await deskService.createDesk({ deskNumber: 'D002', location: 'Office B', isActive: true });

    // Create parking spaces
    const parkingService = new ParkingSpaceService();
    parkingSpace1 = await parkingService.createParkingSpace({ spaceNumber: 'P001', location: 'Lot A', isActive: true });
    parkingSpace2 = await parkingService.createParkingSpace({ spaceNumber: 'P002', location: 'Lot B', isActive: true });

    // Create bookings
    const bookingService = new BookingService();
    const futureStartDate = new Date();
    futureStartDate.setDate(futureStartDate.getDate() + 1);
    const futureEndDate = new Date(futureStartDate);
    futureEndDate.setDate(futureEndDate.getDate() + 2);

    booking1 = await bookingService.createBooking(
      regularUser.id,
      desk1.id,
      futureStartDate.toISOString().split('T')[0],
      futureEndDate.toISOString().split('T')[0]
    );

    const futureStartDate2 = new Date(futureStartDate);
    futureStartDate2.setDate(futureStartDate2.getDate() + 1);
    const futureEndDate2 = new Date(futureStartDate2);
    futureEndDate2.setDate(futureEndDate2.getDate() + 1);

    booking2 = await bookingService.createBooking(
      adminUser.id,
      desk2.id,
      futureStartDate2.toISOString().split('T')[0],
      futureEndDate2.toISOString().split('T')[0]
    );

    // Create parking reservations
    const reservationService = new ParkingReservationService();
    const reservationDate1 = new Date(futureStartDate);
    reservationDate1.setDate(reservationDate1.getDate() + 1);

    reservation1 = await reservationService.createReservation(
      regularUser.id,
      parkingSpace1.id,
      reservationDate1.toISOString().split('T')[0],
      'morning'
    );

    const reservationDate2 = new Date(futureStartDate);
    reservationDate2.setDate(reservationDate2.getDate() + 2);

    reservation2 = await reservationService.createReservation(
      adminUser.id,
      parkingSpace2.id,
      reservationDate2.toISOString().split('T')[0],
      'full_day'
    );
  });

  describe('GET /api/matrix/bookings', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/matrix/bookings')
        .query({ startDate: '2025-12-01', endDate: '2025-12-05' });

      expect(response.status).toBe(401);
    });

    test('should require admin role', async () => {
      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .query({ startDate: '2025-12-01', endDate: '2025-12-05' });

      expect(response.status).toBe(403);
    });

    test('should return matrix data for date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('dateRange');
      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.dateRange)).toBe(true);
      expect(Array.isArray(response.body.users)).toBe(true);
    });

    test('should return error if start date is missing', async () => {
      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ endDate: '2025-12-05' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_DATES');
    });

    test('should return error if end date is missing', async () => {
      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ startDate: '2025-12-01' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_DATES');
    });

    test('should filter by user IDs', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          userIds: regularUser.id,
        });

      expect(response.status).toBe(200);
      expect(response.body.users.length).toBeLessThanOrEqual(1);
    });

    test('should filter by desk IDs', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          deskIds: desk1.id,
          type: 'desks',
        });

      expect(response.status).toBe(200);
    });

    test('should filter by parking space IDs', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          parkingSpaceIds: parkingSpace1.id,
          type: 'parking',
        });

      expect(response.status).toBe(200);
    });

    test('should return combined view by default', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        });

      expect(response.status).toBe(200);
      // Should include both desk and parking data
    });

    test('should return desks only view', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          type: 'desks',
        });

      expect(response.status).toBe(200);
    });

    test('should return parking only view', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 5);

      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          type: 'parking',
        });

      expect(response.status).toBe(200);
    });

    test('should return error for invalid date format', async () => {
      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: 'invalid-date',
          endDate: '2025-12-05',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DATE');
    });

    test('should return error if start date is after end date', async () => {
      const response = await request(app)
        .get('/api/matrix/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          startDate: '2025-12-05',
          endDate: '2025-12-01',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_DATE');
    });
  });
});

