const OvertimeService = require('../../src/backend/services/OvertimeService');
const OvertimeRecordRepository = require('../../src/backend/repositories/OvertimeRecordRepository');
const OvertimeRecord = require('../../src/backend/models/OvertimeRecord');

jest.mock('../../src/backend/repositories/OvertimeRecordRepository');

describe('OvertimeService', () => {
  let overtimeService;
  let mockOvertimeRecordRepository;

  beforeEach(() => {
    mockOvertimeRecordRepository = new OvertimeRecordRepository();
    overtimeService = new OvertimeService();
    overtimeService.overtimeRecordRepository = mockOvertimeRecordRepository;
  });

  describe('calculateTotalHours', () => {
    test('should calculate hours correctly', () => {
      const hours = overtimeService.calculateTotalHours('09:00:00', '17:00:00');
      expect(hours).toBe(8);
    });

    test('should calculate fractional hours correctly', () => {
      const hours = overtimeService.calculateTotalHours('17:00:00', '18:30:00');
      expect(hours).toBe(1.5);
    });

    test('should throw error when end time is before start time', () => {
      expect(() => {
        overtimeService.calculateTotalHours('17:00:00', '09:00:00');
      }).toThrow('End time must be after start time');
    });

    test('should handle time without seconds', () => {
      const hours = overtimeService.calculateTotalHours('09:00', '17:00');
      expect(hours).toBe(8);
    });
  });

  describe('createOvertimeRecord', () => {
    test('should create overtime record successfully', async () => {
      const userId = 1;
      const recordDate = '2025-12-15';
      const startTime = '17:00:00';
      const endTime = '18:00:00';
      const description = 'Extended work';

      const mockRecord = new OvertimeRecord({
        id: 1,
        user_id: userId,
        record_date: recordDate,
        start_time: startTime,
        end_time: endTime,
        total_hours: 1,
        description: description,
        status: 'pending',
      });

      mockOvertimeRecordRepository.create = jest.fn().mockResolvedValue(mockRecord);

      const result = await overtimeService.createOvertimeRecord(
        userId,
        recordDate,
        startTime,
        endTime,
        description
      );

      expect(result).toEqual(mockRecord);
      expect(mockOvertimeRecordRepository.create).toHaveBeenCalled();
    });

    test('should throw error when date is in the future', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      await expect(
        overtimeService.createOvertimeRecord(1, futureDate, '17:00:00', '18:00:00')
      ).rejects.toThrow('Cannot record overtime for future dates');
    });

    test('should throw error when hours exceed 24', async () => {
      await expect(
        overtimeService.createOvertimeRecord(1, '2025-12-15', '00:00:00', '23:59:59')
      ).rejects.toThrow('Overtime hours cannot exceed 24 hours per day');
    });
  });

  describe('getUserOvertimeRecords', () => {
    test('should return user overtime records', async () => {
      const mockRecords = [
        new OvertimeRecord({
          id: 1,
          user_id: 1,
          record_date: '2025-12-15',
          start_time: '17:00:00',
          end_time: '18:00:00',
          total_hours: 1,
        }),
      ];

      mockOvertimeRecordRepository.findByUserId = jest.fn().mockResolvedValue(mockRecords);

      const result = await overtimeService.getUserOvertimeRecords(1);

      expect(result).toEqual(mockRecords);
      expect(mockOvertimeRecordRepository.findByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe('updateOvertimeRecord', () => {
    test('should update overtime record successfully', async () => {
      const existingRecord = new OvertimeRecord({
        id: 1,
        user_id: 1,
        record_date: '2025-12-15',
        start_time: '17:00:00',
        end_time: '18:00:00',
        total_hours: 1,
        status: 'pending',
      });

      const updatedRecord = new OvertimeRecord({
        ...existingRecord.toJSON(),
        start_time: '17:00:00',
        end_time: '19:00:00',
        total_hours: 2,
      });

      mockOvertimeRecordRepository.findById = jest.fn()
        .mockResolvedValueOnce(existingRecord)
        .mockResolvedValueOnce(updatedRecord);
      mockOvertimeRecordRepository.update = jest.fn().mockResolvedValue(updatedRecord);

      const result = await overtimeService.updateOvertimeRecord(
        1,
        1,
        '2025-12-15',
        '17:00:00',
        '19:00:00',
        'Updated description'
      );

      expect(result).toEqual(updatedRecord);
      expect(mockOvertimeRecordRepository.update).toHaveBeenCalled();
    });

    test('should throw error when trying to update approved record', async () => {
      const approvedRecord = new OvertimeRecord({
        id: 1,
        user_id: 1,
        record_date: '2025-12-15',
        start_time: '17:00:00',
        end_time: '18:00:00',
        total_hours: 1,
        status: 'approved',
      });

      mockOvertimeRecordRepository.findById = jest.fn().mockResolvedValue(approvedRecord);

      await expect(
        overtimeService.updateOvertimeRecord(1, 1, '2025-12-15', '17:00:00', '19:00:00')
      ).rejects.toThrow('Cannot update approved overtime records');
    });
  });

  describe('approveOvertimeRecord', () => {
    test('should approve overtime record successfully', async () => {
      const pendingRecord = new OvertimeRecord({
        id: 1,
        user_id: 1,
        status: 'pending',
      });

      const approvedRecord = new OvertimeRecord({
        ...pendingRecord.toJSON(),
        status: 'approved',
      });

      mockOvertimeRecordRepository.findById = jest.fn()
        .mockResolvedValueOnce(pendingRecord)
        .mockResolvedValueOnce(approvedRecord);
      mockOvertimeRecordRepository.approve = jest.fn().mockResolvedValue(approvedRecord);

      const result = await overtimeService.approveOvertimeRecord(1, 2);

      expect(result).toEqual(approvedRecord);
      expect(mockOvertimeRecordRepository.approve).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('getOvertimeReport', () => {
    test('should generate overtime report', async () => {
      const mockRecords = [
        new OvertimeRecord({
          id: 1,
          user_id: 1,
          record_date: '2025-12-15',
          start_time: '17:00:00',
          end_time: '18:00:00',
          total_hours: 1,
          status: 'approved',
        }),
      ];

      mockOvertimeRecordRepository.findByUserIdAndDateRange = jest.fn().mockResolvedValue(mockRecords);
      mockOvertimeRecordRepository.getTotalHoursByUser = jest.fn().mockResolvedValue(1);

      const result = await overtimeService.getOvertimeReport(1, '2025-12-01', '2025-12-31');

      expect(result.userId).toBe(1);
      expect(result.totalHours).toBe(1);
      expect(result.recordCount).toBe(1);
    });
  });
});

