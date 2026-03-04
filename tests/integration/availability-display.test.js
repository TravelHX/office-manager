const request = require('supertest');
const app = require('../../src/backend/server');
const { executeQuery } = require('../../src/backend/database/connection');
const { hashPassword } = require('../../src/backend/utils/password');

describe('Availability Display Enhancement', () => {
  let authToken;
  let userId;
  let deskId1, deskId2, deskId3;
  let spaceId1, spaceId2, spaceId3;

  beforeAll(async () => {
    // Create test user
    const passwordHash = await hashPassword('testpass123');
    const userResult = await executeQuery(`
      INSERT INTO users (id, username, password_hash, is_admin) 
      VALUES ('test001', 'testuser', ?, 0)
    `, [passwordHash]);
    userId = 'test001';

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'testpass123' });
    authToken = loginResponse.body.token;
  });

  beforeEach(async () => {
    // Clean up
    await executeQuery('DELETE FROM bookings');
    await executeQuery('DELETE FROM parking_reservations');
    await executeQuery('DELETE FROM desks');
    await executeQuery('DELETE FROM parking_spaces');

    // Create test desks
    const desk1Result = await executeQuery(`
      INSERT INTO desks (desk_number, location, is_active) 
      VALUES ('1', 'Floor 1', 1)
    `);
    deskId1 = desk1Result.insertId;

    const desk2Result = await executeQuery(`
      INSERT INTO desks (desk_number, location, is_active) 
      VALUES ('2', 'Floor 1', 1)
    `);
    deskId2 = desk2Result.insertId;

    const desk3Result = await executeQuery(`
      INSERT INTO desks (desk_number, location, is_active) 
      VALUES ('3', 'Floor 2', 1)
    `);
    deskId3 = desk3Result.insertId;

    // Create test parking spaces
    const space1Result = await executeQuery(`
      INSERT INTO parking_spaces (space_number, location, is_active) 
      VALUES ('1', 'Lot A', 1)
    `);
    spaceId1 = space1Result.insertId;

    const space2Result = await executeQuery(`
      INSERT INTO parking_spaces (space_number, location, is_active) 
      VALUES ('2', 'Lot A', 1)
    `);
    spaceId2 = space2Result.insertId;

    const space3Result = await executeQuery(`
      INSERT INTO parking_spaces (space_number, location, is_active) 
      VALUES ('3', 'Lot B', 1)
    `);
    spaceId3 = space3Result.insertId;
  });

  afterAll(async () => {
    await executeQuery('DELETE FROM bookings');
    await executeQuery('DELETE FROM parking_reservations');
    await executeQuery('DELETE FROM desks');
    await executeQuery('DELETE FROM parking_spaces');
    await executeQuery('DELETE FROM users WHERE id = ?', [userId]);
  });

  describe('Desk Availability API', () => {
    test('should return remaining desk count when all desks are available', async () => {
      const response = await request(app)
        .get('/api/bookings/available')
        .query({ startDate: '2026-12-01', endDate: '2026-12-02' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('availableDesks');
      expect(response.body).toHaveProperty('totalDesks', 3);
      expect(response.body).toHaveProperty('remainingDesks', 3);
      expect(response.body).toHaveProperty('bookedDesks', 0);
      expect(response.body.availableDesks).toHaveLength(3);
    });

    test('should return remaining desk count when some desks are booked', async () => {
      // Book one desk
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-02', 'active')
      `, [userId, deskId1]);

      const response = await request(app)
        .get('/api/bookings/available')
        .query({ startDate: '2026-12-01', endDate: '2026-12-02' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalDesks).toBe(3);
      expect(response.body.remainingDesks).toBe(2);
      expect(response.body.bookedDesks).toBe(1);
      expect(response.body.availableDesks).toHaveLength(2);
    });

    test('should return remaining desk count when all desks are booked', async () => {
      // Book all desks
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-02', 'active'),
               (?, ?, '2026-12-01', '2026-12-02', 'active'),
               (?, ?, '2026-12-01', '2026-12-02', 'active')
      `, [userId, deskId1, userId, deskId2, userId, deskId3]);

      const response = await request(app)
        .get('/api/bookings/available')
        .query({ startDate: '2026-12-01', endDate: '2026-12-02' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalDesks).toBe(3);
      expect(response.body.remainingDesks).toBe(0);
      expect(response.body.bookedDesks).toBe(3);
      expect(response.body.availableDesks).toHaveLength(0);
    });
  });

  describe('Parking Space Availability API', () => {
    test('should return remaining parking space count when all spaces are available', async () => {
      const response = await request(app)
        .get('/api/parking-spaces/available')
        .query({ reservationDate: '2026-12-01', timePeriod: 'morning' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('availableSpaces');
      expect(response.body).toHaveProperty('totalSpaces', 3);
      expect(response.body).toHaveProperty('remainingSpaces', 3);
      expect(response.body).toHaveProperty('bookedSpaces', 0);
      expect(response.body.availableSpaces).toHaveLength(3);
    });

    test('should return remaining parking space count when some spaces are booked', async () => {
      // Reserve one space
      await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'morning', 'active')
      `, [userId, spaceId1]);

      const response = await request(app)
        .get('/api/parking-spaces/available')
        .query({ reservationDate: '2026-12-01', timePeriod: 'morning' });

      expect(response.status).toBe(200);
      expect(response.body.totalSpaces).toBe(3);
      expect(response.body.remainingSpaces).toBe(2);
      expect(response.body.bookedSpaces).toBe(1);
      expect(response.body.availableSpaces).toHaveLength(2);
    });

    test('should return remaining parking space count when all spaces are booked', async () => {
      // Reserve all spaces
      await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'morning', 'active'),
               (?, ?, '2026-12-01', 'morning', 'active'),
               (?, ?, '2026-12-01', 'morning', 'active')
      `, [userId, spaceId1, userId, spaceId2, userId, spaceId3]);

      const response = await request(app)
        .get('/api/parking-spaces/available')
        .query({ reservationDate: '2026-12-01', timePeriod: 'morning' });

      expect(response.status).toBe(200);
      expect(response.body.totalSpaces).toBe(3);
      expect(response.body.remainingSpaces).toBe(0);
      expect(response.body.bookedSpaces).toBe(3);
      expect(response.body.availableSpaces).toHaveLength(0);
    });

    test('should return different counts for different time periods', async () => {
      // Reserve space for morning only
      await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'morning', 'active')
      `, [userId, spaceId1]);

      const morningResponse = await request(app)
        .get('/api/parking-spaces/available')
        .query({ reservationDate: '2026-12-01', timePeriod: 'morning' });

      const afternoonResponse = await request(app)
        .get('/api/parking-spaces/available')
        .query({ reservationDate: '2026-12-01', timePeriod: 'afternoon' });

      expect(morningResponse.body.remainingSpaces).toBe(2);
      expect(afternoonResponse.body.remainingSpaces).toBe(3);
    });
  });
});
