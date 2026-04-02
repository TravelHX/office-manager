const request = require('supertest');
const app = require('../../src/backend/server');
const UserService = require('../../src/backend/services/UserService');
const AdminService = require('../../src/backend/services/AdminService');
const { generateToken } = require('../../src/backend/utils/token');
const { createProvisionedUserWithPassword } = require('../helpers/provisionUser');

describe('Booking Validation Rules - Phase 10', () => {
  let user1Token, user2Token;
  let user1Id, user2Id;
  let testDesk1Id, testDesk2Id;
  let testParkingSpace1Id, testParkingSpace2Id;

  beforeAll(async () => {
    const userService = new UserService();
    const admin = await userService.getUserByUsername('admin');
    const user1 = await createProvisionedUserWithPassword(admin.id, {
      email: 'user1@test.com',
      name: 'User One',
      password: 'password123',
    });
    const user2 = await createProvisionedUserWithPassword(admin.id, {
      email: 'user2@test.com',
      name: 'User Two',
      password: 'password123',
    });
    user1Id = user1.id;
    user2Id = user2.id;

    await userService.authenticate('user1@test.com', 'password123');
    await userService.authenticate('user2@test.com', 'password123');
    user1Token = generateToken(user1);
    user2Token = generateToken(user2);

    // Create test desks
    const adminService = new AdminService();
    await adminService.updateDeskCount(2, 'auto', 1);
    const desks = await adminService.getAllDesks();
    testDesk1Id = desks[0].id;
    testDesk2Id = desks[1].id;

    // Create test parking spaces
    await adminService.updateParkingCount(2, 'auto', 1);
    const parkingSpaces = await adminService.getAllParkingSpaces();
    testParkingSpace1Id = parkingSpaces[0].id;
    testParkingSpace2Id = parkingSpaces[1].id;
  });

  describe('User Overlap Validation - Desk Bookings', () => {
    test('should prevent user from booking multiple desks for overlapping dates', async () => {
      const startDate = '2026-12-15';
      const endDate = '2026-12-17';

      // User 1 books desk 1
      const booking1 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate,
          endDate: endDate,
        });

      expect(booking1.status).toBe(201);

      // User 1 tries to book desk 2 for overlapping dates (should fail)
      const booking2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk2Id,
          startDate: '2026-12-16', // Overlaps with previous booking
          endDate: '2026-12-18',
        });

      expect(booking2.status).toBe(400);
      expect(booking2.body.error.message).toMatch(/already have a desk booking/i);
    });

    test('should prevent user from booking multiple desks for completely overlapping dates', async () => {
      const startDate = '2026-12-20';
      const endDate = '2026-12-22';

      // User 1 books desk 1
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate,
          endDate: endDate,
        });

      // User 1 tries to book desk 2 for exact same dates (should fail)
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk2Id,
          startDate: startDate,
          endDate: endDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/already have a desk booking/i);
    });

    test('should prevent user from booking multiple desks for partial overlaps', async () => {
      const startDate = '2026-12-25';
      const endDate = '2026-12-30';

      // User 1 books desk 1
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate,
          endDate: endDate,
        });

      // User 1 tries to book desk 2 with partial overlap (should fail)
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk2Id,
          startDate: '2026-12-28', // Overlaps with previous booking
          endDate: '2027-01-05',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/already have a desk booking/i);
    });

    test('should allow user to book different desks for non-overlapping dates', async () => {
      const startDate1 = '2027-01-10';
      const endDate1 = '2027-01-12';
      const startDate2 = '2027-01-15';
      const endDate2 = '2027-01-17';

      // User 1 books desk 1
      const booking1 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate1,
          endDate: endDate1,
        });

      expect(booking1.status).toBe(201);

      // User 1 books desk 2 for non-overlapping dates (should succeed)
      const booking2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk2Id,
          startDate: startDate2,
          endDate: endDate2,
        });

      expect(booking2.status).toBe(201);
    });
  });

  describe('Desk Availability Validation - Multiple Users', () => {
    test('should prevent multiple users from booking same desk for same day', async () => {
      const startDate = '2027-01-20';
      const endDate = '2027-01-22';

      // User 1 books desk 1
      const booking1 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate,
          endDate: endDate,
        });

      expect(booking1.status).toBe(201);

      // User 2 tries to book same desk for overlapping dates (should fail)
      const booking2 = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: '2027-01-21', // Overlaps with user 1's booking
          endDate: '2027-01-23',
        });

      expect(booking2.status).toBe(400);
      expect(booking2.body.error.message).toMatch(/already booked by another user/i);
    });

    test('should prevent multiple users from booking same desk for exact same dates', async () => {
      const startDate = '2027-01-25';
      const endDate = '2027-01-27';

      // User 1 books desk 1
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate,
          endDate: endDate,
        });

      // User 2 tries to book same desk for exact same dates (should fail)
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate,
          endDate: endDate,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/already booked by another user/i);
    });
  });

  describe('User Overlap Validation - Parking Reservations', () => {
    test('should prevent user from booking multiple parking spaces for same date and time period', async () => {
      const reservationDate = '2027-02-01';
      const timePeriod = 'morning';

      // User 1 reserves parking space 1
      const reservation1 = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      expect(reservation1.status).toBe(201);

      // User 1 tries to reserve parking space 2 for same date and time period (should fail)
      const reservation2 = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace2Id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      expect(reservation2.status).toBe(400);
      expect(reservation2.body.error.message).toMatch(/already have a parking reservation/i);
    });

    test('should prevent user from booking full_day when they have morning reservation', async () => {
      const reservationDate = '2027-02-05';

      // User 1 reserves parking space 1 for morning
      await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: 'morning',
        });

      // User 1 tries to reserve parking space 2 for full_day (should fail - overlaps with morning)
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace2Id,
          reservationDate: reservationDate,
          timePeriod: 'full_day',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/already have a parking reservation/i);
    });

    test('should allow user to book different time periods on same date', async () => {
      const reservationDate = '2027-02-10';

      // User 1 reserves parking space 1 for morning
      const reservation1 = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: 'morning',
        });

      expect(reservation1.status).toBe(201);

      // User 1 reserves parking space 2 for afternoon (should succeed - no overlap)
      const reservation2 = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace2Id,
          reservationDate: reservationDate,
          timePeriod: 'afternoon',
        });

      expect(reservation2.status).toBe(201);
    });
  });

  describe('Parking Space Availability Validation - Multiple Users', () => {
    test('should prevent multiple users from booking same parking space for same date and time period', async () => {
      const reservationDate = '2027-02-15';
      const timePeriod = 'morning';

      // User 1 reserves parking space 1
      const reservation1 = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      expect(reservation1.status).toBe(201);

      // User 2 tries to reserve same parking space for same date and time period (should fail)
      const reservation2 = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      expect(reservation2.status).toBe(400);
      expect(reservation2.body.error.message).toMatch(/already reserved by another user/i);
    });

    test('should prevent multiple users from booking same parking space when one has full_day', async () => {
      const reservationDate = '2027-02-20';

      // User 1 reserves parking space 1 for full_day
      await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: 'full_day',
        });

      // User 2 tries to reserve same parking space for morning (should fail - conflicts with full_day)
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: 'morning',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toMatch(/already reserved by another user/i);
    });
  });

  describe('Error Message Clarity', () => {
    test('should provide clear error message for user desk overlap', async () => {
      const startDate = '2027-03-01';
      const endDate = '2027-03-05';

      // User 1 books desk 1
      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk1Id,
          startDate: startDate,
          endDate: endDate,
        });

      // User 1 tries to book desk 2 for overlapping dates
      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          deskId: testDesk2Id,
          startDate: '2027-03-03',
          endDate: '2027-03-07',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('already have a desk booking');
      expect(response.body.error.message).toContain('overlap');
      expect(response.body.error.message).toContain('cannot book multiple desks');
    });

    test('should provide clear error message for parking space overlap', async () => {
      const reservationDate = '2027-03-10';
      const timePeriod = 'afternoon';

      // User 1 reserves parking space 1
      await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace1Id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      // User 1 tries to reserve parking space 2 for same date and time period
      const response = await request(app)
        .post('/api/parking-reservations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          parkingSpaceId: testParkingSpace2Id,
          reservationDate: reservationDate,
          timePeriod: timePeriod,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('already have a parking reservation');
      expect(response.body.error.message).toContain('cannot book multiple parking spaces');
    });
  });
});

