const OvertimeRecordRepository = require('../../src/backend/repositories/OvertimeRecordRepository');
const OvertimeRecord = require('../../src/backend/models/OvertimeRecord');
const { executeQuery } = require('../../src/backend/database/connection');

describe('OvertimeRecordRepository', () => {
  let repository;
  let userId1;

  beforeAll(async () => {
    repository = new OvertimeRecordRepository();
  });

  beforeEach(async () => {
    await executeQuery('DELETE FROM overtime_records');
    await executeQuery('DELETE FROM users');

    await executeQuery(`
      INSERT INTO users (id, username, password_hash, is_admin) 
      VALUES ('0001', 'user1', 'hash1', 0)
    `);
    userId1 = '0001';
  });

  describe('findByUserId', () => {
    test('should return overtime records for user', async () => {
      await executeQuery(`
        INSERT INTO overtime_records (user_id, record_date, start_time, end_time, total_hours, status)
        VALUES (?, '2026-12-01', '17:00:00', '18:00:00', 1.0, 'pending'),
               (?, '2026-12-02', '17:00:00', '19:00:00', 2.0, 'approved')
      `, [userId1, userId1]);

      const records = await repository.findByUserId(userId1);

      expect(records).toHaveLength(2);
      expect(records.every(r => r instanceof OvertimeRecord)).toBe(true);
    });
  });

  describe('findByUserIdAndDateRange', () => {
    test('should return records within date range', async () => {
      await executeQuery(`
        INSERT INTO overtime_records (user_id, record_date, start_time, end_time, total_hours, status)
        VALUES (?, '2026-12-01', '17:00:00', '18:00:00', 1.0, 'pending'),
               (?, '2026-12-05', '17:00:00', '19:00:00', 2.0, 'approved')
      `, [userId1, userId1]);

      const records = await repository.findByUserIdAndDateRange(
        userId1,
        '2026-12-01',
        '2026-12-03'
      );

      expect(records).toHaveLength(1);
    });
  });

  describe('findByStatus', () => {
    test('should return records by status with username', async () => {
      await executeQuery(`
        INSERT INTO overtime_records (user_id, record_date, start_time, end_time, total_hours, status)
        VALUES (?, '2026-12-01', '17:00:00', '18:00:00', 1.0, 'pending')
      `, [userId1]);

      const records = await repository.findByStatus('pending');

      expect(records.length).toBeGreaterThan(0);
      expect(records[0].username).toBeDefined();
    });
  });

  describe('approve', () => {
    test('should approve overtime record', async () => {
      const result = await executeQuery(`
        INSERT INTO overtime_records (user_id, record_date, start_time, end_time, total_hours, status)
        VALUES (?, '2026-12-01', '17:00:00', '18:00:00', 1.0, 'pending')
      `, [userId1]);
      const id = result.insertId;

      const approved = await repository.approve(id, userId1);

      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(userId1);
    });
  });

  describe('reject', () => {
    test('should reject overtime record', async () => {
      const result = await executeQuery(`
        INSERT INTO overtime_records (user_id, record_date, start_time, end_time, total_hours, status)
        VALUES (?, '2026-12-01', '17:00:00', '18:00:00', 1.0, 'pending')
      `, [userId1]);
      const id = result.insertId;

      const rejected = await repository.reject(id, userId1);

      expect(rejected.status).toBe('rejected');
    });
  });

  describe('getTotalHoursByUser', () => {
    test('should return total approved hours', async () => {
      await executeQuery(`
        INSERT INTO overtime_records (user_id, record_date, start_time, end_time, total_hours, status)
        VALUES (?, '2026-12-01', '17:00:00', '18:00:00', 1.0, 'approved'),
               (?, '2026-12-02', '17:00:00', '19:00:00', 2.0, 'approved'),
               (?, '2026-12-03', '17:00:00', '18:00:00', 1.0, 'pending')
      `, [userId1, userId1, userId1]);

      const total = await repository.getTotalHoursByUser(
        userId1,
        '2026-12-01',
        '2026-12-31'
      );

      expect(total).toBe(3.0);
    });
  });
});
