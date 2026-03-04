const DeskService = require('../../src/backend/services/DeskService');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const Desk = require('../../src/backend/models/Desk');

jest.mock('../../src/backend/repositories/DeskRepository');
jest.mock('../../src/backend/repositories/BookingRepository');

describe('DeskService', () => {
  let deskService;
  let mockDeskRepository;
  let mockBookingRepository;

  beforeEach(() => {
    mockDeskRepository = new DeskRepository();
    mockBookingRepository = new BookingRepository();
    deskService = new DeskService();
    deskService.deskRepository = mockDeskRepository;
    deskService.bookingRepository = mockBookingRepository;
  });

  describe('getAllDesks', () => {
    test('should return all active desks', async () => {
      const mockDesks = [
        new Desk({ id: 1, desk_number: 'D001', location: 'Floor 1', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', location: 'Floor 1', is_active: 1 }),
      ];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(mockDesks);

      const result = await deskService.getAllDesks();

      expect(result).toEqual(mockDesks);
      expect(mockDeskRepository.findAllActive).toHaveBeenCalled();
    });
  });

  describe('getDeskById', () => {
    test('should return desk when found', async () => {
      const mockDesk = new Desk({ id: 1, desk_number: 'D001', location: 'Floor 1', is_active: 1 });
      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);

      const result = await deskService.getDeskById(1);

      expect(result).toEqual(mockDesk);
      expect(mockDeskRepository.findById).toHaveBeenCalledWith(1);
    });

    test('should throw error when desk not found', async () => {
      mockDeskRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(deskService.getDeskById(999)).rejects.toThrow('Desk not found');
    });
  });

  describe('createDesk', () => {
    test('should create desk successfully', async () => {
      const deskData = { deskNumber: 'D001', location: 'Floor 1', description: 'Test desk' };
      const mockDesk = new Desk({ id: 1, ...deskData, is_active: 1 });

      mockDeskRepository.findByDeskNumber = jest.fn().mockResolvedValue(null);
      mockDeskRepository.create = jest.fn().mockResolvedValue(mockDesk);
      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);

      const result = await deskService.createDesk(deskData);

      expect(result).toEqual(mockDesk);
      expect(mockDeskRepository.findByDeskNumber).toHaveBeenCalledWith('D001');
      expect(mockDeskRepository.create).toHaveBeenCalled();
    });

    test('should throw error when desk number already exists', async () => {
      const deskData = { deskNumber: 'D001', location: 'Floor 1' };
      const existingDesk = new Desk({ id: 1, desk_number: 'D001' });

      mockDeskRepository.findByDeskNumber = jest.fn().mockResolvedValue(existingDesk);

      await expect(deskService.createDesk(deskData)).rejects.toThrow('already exists');
    });
  });

  describe('getAvailableDesks', () => {
    test('should return only desks without conflicts', async () => {
      const allDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
      ];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(allDesks);
      mockBookingRepository.findConflictingBookings = jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }]);

      const result = await deskService.getAvailableDesks('2025-01-01', '2025-01-02');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('getAvailabilityInfo', () => {
    test('should return availability info with remaining desk count', async () => {
      const allDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
        new Desk({ id: 3, desk_number: 'D003', is_active: 1 }),
      ];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(allDesks);
      mockBookingRepository.findConflictingBookings = jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([]);

      const result = await deskService.getAvailabilityInfo('2026-12-01', '2026-12-02');

      expect(result.totalDesks).toBe(3);
      expect(result.remainingDesks).toBe(2);
      expect(result.bookedDesks).toBe(1);
      expect(result.availableDesks).toHaveLength(2);
    });

    test('should return correct counts when all desks are available', async () => {
      const allDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
      ];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(allDesks);
      mockBookingRepository.findConflictingBookings = jest.fn()
        .mockResolvedValue([]);

      const result = await deskService.getAvailabilityInfo('2026-12-01', '2026-12-02');

      expect(result.totalDesks).toBe(2);
      expect(result.remainingDesks).toBe(2);
      expect(result.bookedDesks).toBe(0);
    });

    test('should return correct counts when all desks are booked', async () => {
      const allDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
      ];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(allDesks);
      mockBookingRepository.findConflictingBookings = jest.fn()
        .mockResolvedValue([{ id: 1 }]);

      const result = await deskService.getAvailabilityInfo('2026-12-01', '2026-12-02');

      expect(result.totalDesks).toBe(2);
      expect(result.remainingDesks).toBe(0);
      expect(result.bookedDesks).toBe(2);
    });
  });
});

