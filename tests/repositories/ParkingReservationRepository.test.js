const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');
const ParkingReservation = require('../../src/backend/models/ParkingReservation');
const { executeQuery } = require('../../src/backend/database/connection');

describe('ParkingReservationRepository', () => {
  let repository;
  let userId1, userId2, spaceId1, spaceId2;

  beforeAll(async () => {
    repository = new ParkingReservationRepository();
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM parking_reservations');
    await executeQuery('DELETE FROM parking_spaces');
    await executeQuery('DELETE FROM users');

    await executeQuery(`
      INSERT INTO users (id, username, password_hash, is_admin) 
      VALUES ('0001', 'user1', 'hash1', 0)
    `);
    userId1 = '0001';

    await executeQuery(`
      INSERT INTO users (id, username, password_hash, is_admin) 
      VALUES ('0002', 'user2', 'hash2', 0)
    `);
    userId2 = '0002';

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
  });

  describe('findByUserId', () => {
    test('should return reservations for user with space info', async () => {
      await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'morning', 'active'),
               (?, ?, '2026-12-02', 'afternoon', 'active')
      `, [userId1, spaceId1, userId1, spaceId2]);

      const reservations = await repository.findByUserId(userId1);

      expect(reservations).toHaveLength(2);
      expect(reservations[0].spaceNumber).toBeDefined();
      expect(reservations[0].location).toBeDefined();
    });
  });

  describe('findConflictingReservations', () => {
    test('should find full_day conflicts', async () => {
      await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'full_day', 'active')
      `, [userId1, spaceId1]);

      const conflicts = await repository.findConflictingReservations(
        spaceId1,
        '2026-12-01',
        'morning'
      );

      expect(conflicts).toHaveLength(1);
    });

    test('should find morning conflicts', async () => {
      await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'morning', 'active')
      `, [userId1, spaceId1]);

      const conflicts = await repository.findConflictingReservations(
        spaceId1,
        '2026-12-01',
        'full_day'
      );

      expect(conflicts).toHaveLength(1);
    });
  });

  describe('findOverlappingUserReservations', () => {
    test('should find overlapping reservations for user', async () => {
      await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'morning', 'active')
      `, [userId1, spaceId1]);

      const overlaps = await repository.findOverlappingUserReservations(
        userId1,
        '2026-12-01',
        'full_day'
      );

      expect(overlaps).toHaveLength(1);
    });
  });

  describe('cancel', () => {
    test('should cancel reservation with reason', async () => {
      const result = await executeQuery(`
        INSERT INTO parking_reservations (user_id, parking_space_id, reservation_date, time_period, status)
        VALUES (?, ?, '2026-12-01', 'morning', 'active')
      `, [userId1, spaceId1]);
      const id = result.insertId;

      const cancelled = await repository.cancel(id, userId2, 'Admin override');

      expect(cancelled.status).toBe('cancelled');
      expect(cancelled.cancelledBy).toBe(userId2);
    });
  });
});
