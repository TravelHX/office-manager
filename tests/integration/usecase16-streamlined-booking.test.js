/**
 * Use Case 16: Streamlined Booking Flow (No Confirmation Modal)
 * 
 * This test validates that booking flows proceed directly without confirmation modals:
 * 1. Desk booking proceeds directly without modal confirmation
 * 2. Parking booking proceeds directly without modal confirmation
 * 3. Success feedback is displayed appropriately
 * 4. Error messages are displayed appropriately
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

describe('Use Case 16: Streamlined Booking Flow (No Confirmation Modal)', () => {
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
  let userToken;

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
      deskNumber: 'UC16-D001',
      location: 'Floor 1 - Test Area',
      description: 'Test desk for Use Case 16',
      isActive: true,
    });
    testDeskId = desk.id;

    // Create a test parking space
    const parkingSpace = await parkingSpaceService.createParkingSpace({
      spaceNumber: 'UC16-P001',
      location: 'Parking Lot A',
      description: 'Test parking space for Use Case 16',
      isActive: true,
    });
    testParkingSpaceId = parkingSpace.id;

    // Create token for test user
    userToken = 'Bearer user_1601';
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

  describe('Desk Booking - Direct Flow Without Modal', () => {
    test('should book desk directly without confirmation modal and return success', async () => {
      const startDate = '2025-12-20';
      const endDate = '2025-12-21';

      // Book desk directly (no confirmation step)
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId: testDeskId,
          startDate: startDate,
          endDate: endDate,
        });

      // Should succeed immediately without requiring confirmation
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.deskId).toBe(testDeskId);
      expect(response.body.startDate).toBe(startDate);
      expect(response.body.endDate).toBe(endDate);
      expect(response.body.message).toBeDefined();
      expect(response.body.message).toContain('successfully');
    });

    test('should display appropriate error message when desk booking fails', async () => {
      const startDate = '2025-12-20';
      const endDate = '2025-12-21';

      // Try to book the same desk again (should fail due to conflict)
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId: testDeskId,
          startDate: startDate,
          endDate: endDate,
        });

      // Should return error immediately without confirmation step
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.message).toMatch(/already|overlap|unavailable/i);
    });

    test('should handle booking errors gracefully without modal interruption', async () => {
      const startDate = '2025-12-25';
      const endDate = '2025-12-26';

      // Try to book non-existent desk
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId: 99999,
          startDate: startDate,
          endDate: endDate,
        });

      // Should return error immediately
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
    });
  });

  describe('Parking Booking - Direct Flow Without Modal', () => {
    test('should reserve parking space directly without confirmation modal and return success', async () => {
      const reservationDate = '2025-12-22';
      const timePeriod = 'morning';

      // Reserve parking space directly (no confirmation step)
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', userToken)
        .send({
          parkingSpaceId: testParkingSpaceId,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      // Should succeed immediately without requiring confirmation
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.parkingSpaceId).toBe(testParkingSpaceId);
      expect(response.body.reservationDate).toBe(reservationDate);
      expect(response.body.timePeriod).toBe(timePeriod);
      expect(response.body.message).toBeDefined();
      expect(response.body.message).toContain('successfully');
    });

    test('should display appropriate error message when parking reservation fails', async () => {
      const reservationDate = '2025-12-22';
      const timePeriod = 'morning';

      // Try to reserve the same parking space again (should fail due to conflict)
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', userToken)
        .send({
          parkingSpaceId: testParkingSpaceId,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      // Should return error immediately without confirmation step
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.message).toMatch(/already|overlap|unavailable/i);
    });

    test('should handle reservation errors gracefully without modal interruption', async () => {
      const reservationDate = '2025-12-27';
      const timePeriod = 'afternoon';

      // Try to reserve non-existent parking space
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', userToken)
        .send({
          parkingSpaceId: 99999,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      // Should return error immediately
      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
    });
  });

  describe('Bulk Booking - Direct Flow Without Modal', () => {
    test('should book multiple desks directly without confirmation modal', async () => {
      // Create additional test desks
      const desk2 = await deskService.createDesk({
        deskNumber: 'UC16-D002',
        location: 'Floor 1 - Test Area',
        description: 'Test desk 2 for Use Case 16',
        isActive: true,
      });

      const startDate = '2025-12-28';
      const endDate = '2025-12-29';

      // Book multiple desks directly (no confirmation step)
      const response = await request(app)
        .post('/api/bookings/bulk')
        .set('Authorization', userToken)
        .send({
          deskIds: [desk2.id],
          startDate: startDate,
          endDate: endDate,
        });

      // Should succeed immediately without requiring confirmation
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(Array.isArray(response.body.successful)).toBe(true);
      expect(response.body.successful.length).toBeGreaterThan(0);

      // Cleanup
      await deskRepository.delete(desk2.id);
    });

    test('should reserve multiple parking spaces directly without confirmation modal', async () => {
      // Create additional test parking space
      const parkingSpace2 = await parkingSpaceService.createParkingSpace({
        spaceNumber: 'UC16-P002',
        location: 'Parking Lot A',
        description: 'Test parking space 2 for Use Case 16',
        isActive: true,
      });

      const reservationDate = '2025-12-30';
      const timePeriod = 'full_day';

      // Reserve multiple parking spaces directly (no confirmation step)
      const response = await request(app)
        .post('/api/parking-reservations/bulk')
        .set('Authorization', userToken)
        .send({
          parkingSpaceIds: [parkingSpace2.id],
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      // Should succeed immediately without requiring confirmation
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('successful');
      expect(response.body).toHaveProperty('failed');
      expect(Array.isArray(response.body.successful)).toBe(true);
      expect(response.body.successful.length).toBeGreaterThan(0);

      // Cleanup
      await parkingSpaceRepository.delete(parkingSpace2.id);
    });
  });

  describe('Success Feedback Validation', () => {
    test('should return success message in API response for desk booking', async () => {
      // Create a new desk for this test
      const desk = await deskService.createDesk({
        deskNumber: 'UC16-D003',
        location: 'Floor 1 - Test Area',
        description: 'Test desk for success feedback',
        isActive: true,
      });

      const startDate = '2025-12-31';
      const endDate = '2026-01-01';

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId: desk.id,
          startDate: startDate,
          endDate: endDate,
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBeDefined();
      expect(response.body.message).toMatch(/success|booked/i);

      // Cleanup
      await deskRepository.delete(desk.id);
    });

    test('should return success message in API response for parking reservation', async () => {
      // Create a new parking space for this test
      const parkingSpace = await parkingSpaceService.createParkingSpace({
        spaceNumber: 'UC16-P003',
        location: 'Parking Lot A',
        description: 'Test parking space for success feedback',
        isActive: true,
      });

      const reservationDate = '2026-01-02';
      const timePeriod = 'afternoon';

      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', userToken)
        .send({
          parkingSpaceId: parkingSpace.id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBeDefined();
      expect(response.body.message).toMatch(/success|reserved/i);

      // Cleanup
      await parkingSpaceRepository.delete(parkingSpace.id);
    });
  });

  describe('Error Message Validation', () => {
    test('should return clear error message for desk booking conflicts', async () => {
      // Create a new desk
      const desk = await deskService.createDesk({
        deskNumber: 'UC16-D004',
        location: 'Floor 1 - Test Area',
        description: 'Test desk for error validation',
        isActive: true,
      });

      const startDate = '2026-01-03';
      const endDate = '2026-01-04';

      // Book desk first time
      await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId: desk.id,
          startDate: startDate,
          endDate: endDate,
        });

      // Try to book same desk again (should fail)
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', userToken)
        .send({
          deskId: desk.id,
          startDate: startDate,
          endDate: endDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.message.length).toBeGreaterThan(0);
      expect(response.body.error.code).toBeDefined();

      // Cleanup
      await deskRepository.delete(desk.id);
    });

    test('should return clear error message for parking reservation conflicts', async () => {
      // Create a new parking space
      const parkingSpace = await parkingSpaceService.createParkingSpace({
        spaceNumber: 'UC16-P004',
        location: 'Parking Lot A',
        description: 'Test parking space for error validation',
        isActive: true,
      });

      const reservationDate = '2026-01-05';
      const timePeriod = 'morning';

      // Reserve parking space first time
      await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', userToken)
        .send({
          parkingSpaceId: parkingSpace.id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      // Try to reserve same parking space again (should fail)
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', userToken)
        .send({
          parkingSpaceId: parkingSpace.id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.message).toBeDefined();
      expect(response.body.error.message.length).toBeGreaterThan(0);
      expect(response.body.error.code).toBeDefined();

      // Cleanup
      await parkingSpaceRepository.delete(parkingSpace.id);
    });
  });
});
