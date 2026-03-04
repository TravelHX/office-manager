const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const Booking = require('../../src/backend/models/Booking');
const { executeQuery } = require('../../src/backend/database/connection');

describe('BookingRepository', () => {
  let repository;
  let userId1, userId2, deskId1, deskId2;

  beforeAll(async () => {
    repository = new BookingRepository();
  });

  beforeEach(async () => {
    // Clean up and create test data
    await executeQuery('DELETE FROM bookings');
    await executeQuery('DELETE FROM desks');
    await executeQuery('DELETE FROM users');

    // Create test users
    const user1Result = await executeQuery(`
      INSERT INTO users (id, username, password_hash, is_admin) 
      VALUES ('0001', 'user1', 'hash1', 0)
    `);
    userId1 = '0001';

    const user2Result = await executeQuery(`
      INSERT INTO users (id, username, password_hash, is_admin) 
      VALUES ('0002', 'user2', 'hash2', 0)
    `);
    userId2 = '0002';

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
  });

  describe('findById', () => {
    test('should return Booking instance when found', async () => {
      const result = await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active')
      `, [userId1, deskId1]);
      const id = result.insertId;

      const booking = await repository.findById(id);

      expect(booking).toBeInstanceOf(Booking);
      expect(booking.id).toBe(id);
    });

    test('should return null when not found', async () => {
      const booking = await repository.findById(99999);
      expect(booking).toBeNull();
    });
  });

  describe('findByUserId', () => {
    test('should return bookings for user with desk info', async () => {
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active'),
               (?, ?, '2026-12-02', '2026-12-02', 'active')
      `, [userId1, deskId1, userId1, deskId2]);

      const bookings = await repository.findByUserId(userId1);

      expect(bookings).toHaveLength(2);
      expect(bookings[0].deskNumber).toBeDefined();
      expect(bookings[0].location).toBeDefined();
      expect(bookings[0].userId).toBe(userId1);
    });

    test('should return empty array when user has no bookings', async () => {
      const bookings = await repository.findByUserId(userId2);
      expect(bookings).toHaveLength(0);
    });
  });

  describe('findByDeskId', () => {
    test('should return all bookings for desk', async () => {
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active'),
               (?, ?, '2026-12-02', '2026-12-02', 'cancelled')
      `, [userId1, deskId1, userId2, deskId1]);

      const bookings = await repository.findByDeskId(deskId1);

      expect(bookings).toHaveLength(2);
      expect(bookings.every(b => b.deskId === deskId1)).toBe(true);
    });
  });

  describe('findActiveByDeskId', () => {
    test('should return only active bookings for desk', async () => {
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active'),
               (?, ?, '2026-12-02', '2026-12-02', 'cancelled')
      `, [userId1, deskId1, userId2, deskId1]);

      const bookings = await repository.findActiveByDeskId(deskId1);

      expect(bookings).toHaveLength(1);
      expect(bookings[0].status).toBe('active');
    });
  });

  describe('findConflictingBookings', () => {
    test('should find overlapping bookings', async () => {
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-03', 'active')
      `, [userId1, deskId1]);

      const conflicts = await repository.findConflictingBookings(
        deskId1,
        '2026-12-02',
        '2026-12-04'
      );

      expect(conflicts).toHaveLength(1);
    });

    test('should exclude specified booking ID', async () => {
      const result = await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-03', 'active')
      `, [userId1, deskId1]);
      const bookingId = result.insertId;

      const conflicts = await repository.findConflictingBookings(
        deskId1,
        '2026-12-01',
        '2026-12-03',
        bookingId
      );

      expect(conflicts).toHaveLength(0);
    });

    test('should not find non-overlapping bookings', async () => {
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active')
      `, [userId1, deskId1]);

      const conflicts = await repository.findConflictingBookings(
        deskId1,
        '2026-12-05',
        '2026-12-05'
      );

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('findOverlappingUserBookings', () => {
    test('should find overlapping bookings for user', async () => {
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-03', 'active')
      `, [userId1, deskId1]);

      const overlaps = await repository.findOverlappingUserBookings(
        userId1,
        '2026-12-02',
        '2026-12-04'
      );

      expect(overlaps).toHaveLength(1);
    });

    test('should exclude specified booking ID', async () => {
      const result = await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-03', 'active')
      `, [userId1, deskId1]);
      const bookingId = result.insertId;

      const overlaps = await repository.findOverlappingUserBookings(
        userId1,
        '2026-12-01',
        '2026-12-03',
        bookingId
      );

      expect(overlaps).toHaveLength(0);
    });
  });

  describe('create', () => {
    test('should create booking from Booking instance', async () => {
      const booking = new Booking({
        userId: userId1,
        deskId: deskId1,
        startDate: '2026-12-01',
        endDate: '2026-12-01',
        status: 'active',
      });

      const created = await repository.create(booking);

      expect(created).toBeInstanceOf(Booking);
      expect(created.id).toBeDefined();
      expect(created.userId).toBe(userId1);
    });

    test('should create booking from plain object', async () => {
      const bookingData = {
        userId: userId1,
        deskId: deskId1,
        startDate: '2026-12-02',
        endDate: '2026-12-02',
        status: 'active',
      };

      const created = await repository.create(bookingData);

      expect(created).toBeInstanceOf(Booking);
      expect(created.userId).toBe(userId1);
    });
  });

  describe('update', () => {
    test('should update booking', async () => {
      const result = await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active')
      `, [userId1, deskId1]);
      const id = result.insertId;

      const updated = await repository.update(id, { status: 'cancelled' });

      expect(updated.status).toBe('cancelled');
    });
  });

  describe('cancel', () => {
    test('should cancel booking with reason', async () => {
      const result = await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active')
      `, [userId1, deskId1]);
      const id = result.insertId;

      const cancelled = await repository.cancel(id, userId2, 'Admin override');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledBy).toBe(userId2);
      expect(cancelled.cancellationReason).toBe('Admin override');
    });
  });

  describe('findAll', () => {
    test('should return all bookings with desk and user info', async () => {
      await executeQuery(`
        INSERT INTO bookings (user_id, desk_id, start_date, end_date, status)
        VALUES (?, ?, '2026-12-01', '2026-12-01', 'active')
      `, [userId1, deskId1]);

      const bookings = await repository.findAll();

      expect(bookings.length).toBeGreaterThan(0);
      expect(bookings[0].deskNumber).toBeDefined();
      expect(bookings[0].username).toBeDefined();
    });
  });
});
