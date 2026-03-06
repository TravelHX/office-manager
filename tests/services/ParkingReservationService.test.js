const ParkingReservationService = require('../../src/backend/services/ParkingReservationService');
const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const ParkingSpaceService = require('../../src/backend/services/ParkingSpaceService');
const ParkingReservation = require('../../src/backend/models/ParkingReservation');
const ParkingSpace = require('../../src/backend/models/ParkingSpace');

jest.mock('../../src/backend/repositories/ParkingReservationRepository');
jest.mock('../../src/backend/repositories/ParkingSpaceRepository');
jest.mock('../../src/backend/services/ParkingSpaceService');

describe('ParkingReservationService', () => {
  let reservationService;
  let mockReservationRepository;
  let mockParkingSpaceRepository;
  let mockParkingSpaceService;

  beforeEach(() => {
    mockReservationRepository = new ParkingReservationRepository();
    mockParkingSpaceRepository = new ParkingSpaceRepository();
    mockParkingSpaceService = new ParkingSpaceService();
    reservationService = new ParkingReservationService();
    reservationService.reservationRepository = mockReservationRepository;
    reservationService.parkingSpaceRepository = mockParkingSpaceRepository;
    reservationService.parkingSpaceService = mockParkingSpaceService;
  });

  describe('createReservation', () => {
    test('should create reservation successfully', async () => {
      const userId = 1;
      const parkingSpaceId = 1;
      const reservationDate = '2026-01-01';
      const timePeriod = 'morning';
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      const mockReservation = new ParkingReservation({
        id: 1,
        user_id: userId,
        parking_space_id: parkingSpaceId,
        reservation_date: reservationDate,
        time_period: timePeriod,
        status: 'active',
      });

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([]);
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn().mockResolvedValue({ available: true });
      mockReservationRepository.create = jest.fn().mockResolvedValue(mockReservation);

      const result = await reservationService.createReservation(userId, parkingSpaceId, reservationDate, timePeriod);

      expect(result).toEqual(mockReservation);
      expect(mockParkingSpaceRepository.findById).toHaveBeenCalledWith(parkingSpaceId);
      expect(mockReservationRepository.findOverlappingUserReservations).toHaveBeenCalledWith(
        userId,
        reservationDate,
        timePeriod
      );
      expect(mockParkingSpaceService.checkParkingSpaceAvailability).toHaveBeenCalledWith(
        parkingSpaceId,
        reservationDate,
        timePeriod
      );
    });

    test('should throw error when parking space not found', async () => {
      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        reservationService.createReservation(1, 999, '2025-01-01', 'morning')
      ).rejects.toThrow('Parking space not found');
    });

    test('should throw error when parking space not available', async () => {
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn().mockResolvedValue({ available: false });

      await expect(
        reservationService.createReservation(1, 1, '2025-01-01', 'morning')
      ).rejects.toThrow('not available');
    });

    test('should throw error when time period is invalid', async () => {
      await expect(
        reservationService.createReservation(1, 1, '2025-01-01', 'invalid')
      ).rejects.toThrow('Time period must be');
    });

    test('should throw error when date is in the past', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const pastDate = yesterday.toISOString().split('T')[0];

      await expect(
        reservationService.createReservation(1, 1, pastDate, 'morning')
      ).rejects.toThrow('Cannot reserve parking spaces for past dates');
    });

    test('should throw error when user has overlapping parking reservation', async () => {
      const userId = 1;
      const parkingSpaceId = 1;
      const reservationDate = '2026-01-01';
      const timePeriod = 'morning';
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      const existingReservation = new ParkingReservation({
        id: 2,
        user_id: userId,
        parking_space_id: 2,
        reservation_date: reservationDate,
        time_period: 'morning',
        status: 'active',
      });

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([existingReservation]);

      await expect(
        reservationService.createReservation(userId, parkingSpaceId, reservationDate, timePeriod)
      ).rejects.toThrow('already have a parking reservation');
    });

    test('should throw error when parking space is already reserved by another user', async () => {
      const userId = 1;
      const parkingSpaceId = 1;
      const reservationDate = '2026-01-01';
      const timePeriod = 'morning';
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      const conflict = {
        id: 2,
        userId: 2,
        parkingSpaceId: parkingSpaceId,
        reservationDate: reservationDate,
        timePeriod: 'morning',
        status: 'active',
      };

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([]);
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn().mockResolvedValue({
        available: false,
        conflicts: [conflict],
      });

      await expect(
        reservationService.createReservation(userId, parkingSpaceId, reservationDate, timePeriod)
      ).rejects.toThrow('already reserved by another user');
    });

    test('should handle full_day time period conflicts correctly', async () => {
      const userId = 1;
      const parkingSpaceId = 1;
      const reservationDate = '2026-01-01';
      const timePeriod = 'full_day';
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      // User already has a morning reservation on the same date
      const existingReservation = new ParkingReservation({
        id: 2,
        user_id: userId,
        parking_space_id: 2,
        reservation_date: reservationDate,
        time_period: 'morning',
        status: 'active',
      });

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([existingReservation]);

      await expect(
        reservationService.createReservation(userId, parkingSpaceId, reservationDate, timePeriod)
      ).rejects.toThrow('already have a parking reservation');
    });

    test('should allow different time periods on same date when no overlap', async () => {
      const userId = 1;
      const parkingSpaceId = 1;
      const reservationDate = '2026-01-01';
      const timePeriod = 'afternoon';
      const mockSpace = new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 });
      const mockReservation = new ParkingReservation({
        id: 1,
        user_id: userId,
        parking_space_id: parkingSpaceId,
        reservation_date: reservationDate,
        time_period: timePeriod,
        status: 'active',
      });

      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(mockSpace);
      // User has morning reservation, but trying to book afternoon (no overlap)
      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([]);
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn().mockResolvedValue({ available: true });
      mockReservationRepository.create = jest.fn().mockResolvedValue(mockReservation);

      const result = await reservationService.createReservation(userId, parkingSpaceId, reservationDate, timePeriod);

      expect(result).toEqual(mockReservation);
    });
  });

  describe('getReservationById', () => {
    test('should return reservation when found', async () => {
      const mockReservation = new ParkingReservation({
        id: 1,
        user_id: 1,
        parking_space_id: 1,
        reservation_date: '2025-01-01',
        time_period: 'morning',
      });
      mockReservationRepository.findById = jest.fn().mockResolvedValue(mockReservation);

      const result = await reservationService.getReservationById(1);

      expect(result).toEqual(mockReservation);
      expect(mockReservationRepository.findById).toHaveBeenCalledWith(1);
    });

    test('should throw error when reservation not found', async () => {
      mockReservationRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(reservationService.getReservationById(999)).rejects.toThrow('Reservation not found');
    });
  });

  describe('getUserReservations', () => {
    test('should return user reservations', async () => {
      const mockReservations = [
        { id: 1, userId: 1, reservationDate: '2025-01-01', timePeriod: 'morning' },
        { id: 2, userId: 1, reservationDate: '2025-01-02', timePeriod: 'afternoon' },
      ];
      mockReservationRepository.findByUserId = jest.fn().mockResolvedValue(mockReservations);

      const result = await reservationService.getUserReservations(1);

      expect(result).toEqual(mockReservations);
      expect(mockReservationRepository.findByUserId).toHaveBeenCalledWith(1);
    });
  });

  describe('cancelUserReservation', () => {
    test('should cancel user reservation successfully', async () => {
      const mockReservation = new ParkingReservation({
        id: 1,
        user_id: 1,
        parking_space_id: 1,
        reservation_date: '2025-01-01',
        time_period: 'morning',
        status: 'active',
      });
      const cancelledReservation = new ParkingReservation({
        ...mockReservation.toJSON(),
        status: 'cancelled',
      });

      mockReservationRepository.findById = jest.fn()
        .mockResolvedValueOnce(mockReservation)
        .mockResolvedValueOnce(cancelledReservation);
      mockReservationRepository.cancel = jest.fn().mockResolvedValue(cancelledReservation);

      const result = await reservationService.cancelUserReservation(1, 1);

      expect(result).toEqual(cancelledReservation);
      expect(mockReservationRepository.cancel).toHaveBeenCalledWith(1, 1, null);
    });

    test('should throw error when reservation not found', async () => {
      mockReservationRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(reservationService.cancelUserReservation(999, 1)).rejects.toThrow('Reservation not found');
    });

    test('should throw error when user tries to cancel another user reservation', async () => {
      const mockReservation = new ParkingReservation({
        id: 1,
        user_id: 1,
        parking_space_id: 1,
        reservation_date: '2025-01-01',
        time_period: 'morning',
        status: 'active',
      });

      mockReservationRepository.findById = jest.fn().mockResolvedValue(mockReservation);

      await expect(reservationService.cancelUserReservation(1, 2)).rejects.toThrow('only cancel your own');
    });

    test('should throw error when reservation already cancelled', async () => {
      const mockReservation = new ParkingReservation({
        id: 1,
        user_id: 1,
        parking_space_id: 1,
        reservation_date: '2025-01-01',
        time_period: 'morning',
        status: 'cancelled',
      });

      mockReservationRepository.findById = jest.fn()
        .mockResolvedValueOnce(mockReservation)
        .mockResolvedValueOnce(mockReservation);
      mockReservationRepository.cancel = jest.fn().mockResolvedValue(mockReservation);

      await expect(reservationService.cancelUserReservation(1, 1)).rejects.toThrow('already cancelled');
    });
  });

  describe('checkAvailability', () => {
    test('should check availability using parking space service', async () => {
      const availability = { available: true, conflicts: [] };
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn().mockResolvedValue(availability);

      const result = await reservationService.checkAvailability(1, '2025-01-01', 'morning');

      expect(result).toEqual(availability);
      expect(mockParkingSpaceService.checkParkingSpaceAvailability).toHaveBeenCalledWith(1, '2025-01-01', 'morning');
    });
  });

  describe('getAvailableParkingSpaces', () => {
    test('should get available parking spaces using parking space service', async () => {
      const mockSpaces = [
        new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 }),
        new ParkingSpace({ id: 2, space_number: 'P002', is_active: 1 }),
      ];
      mockParkingSpaceService.getAvailableParkingSpaces = jest.fn().mockResolvedValue(mockSpaces);

      const result = await reservationService.getAvailableParkingSpaces('2025-01-01', 'morning');

      expect(result).toEqual(mockSpaces);
      expect(mockParkingSpaceService.getAvailableParkingSpaces).toHaveBeenCalledWith('2025-01-01', 'morning');
    });
  });

  describe('createBulkReservations', () => {
    test('should create multiple reservations successfully', async () => {
      const userId = 1;
      const parkingSpaceIds = [1, 2, 3];
      const reservationDate = '2026-12-15';
      const timePeriod = 'morning';
      
      const mockSpaces = [
        new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 }),
        new ParkingSpace({ id: 2, space_number: 'P002', is_active: 1 }),
        new ParkingSpace({ id: 3, space_number: 'P003', is_active: 1 }),
      ];
      
      const mockReservations = [
        new ParkingReservation({ id: 1, user_id: userId, parking_space_id: 1, reservation_date: reservationDate, time_period: timePeriod, status: 'active' }),
        new ParkingReservation({ id: 2, user_id: userId, parking_space_id: 2, reservation_date: reservationDate, time_period: timePeriod, status: 'active' }),
        new ParkingReservation({ id: 3, user_id: userId, parking_space_id: 3, reservation_date: reservationDate, time_period: timePeriod, status: 'active' }),
      ];

      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([]);
      mockParkingSpaceRepository.findById = jest.fn()
        .mockResolvedValueOnce(mockSpaces[0])
        .mockResolvedValueOnce(mockSpaces[1])
        .mockResolvedValueOnce(mockSpaces[2]);
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn().mockResolvedValue({ available: true });
      mockReservationRepository.create = jest.fn()
        .mockResolvedValueOnce(mockReservations[0])
        .mockResolvedValueOnce(mockReservations[1])
        .mockResolvedValueOnce(mockReservations[2]);

      const result = await reservationService.createBulkReservations(userId, parkingSpaceIds, reservationDate, timePeriod);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockReservationRepository.findOverlappingUserReservations).toHaveBeenCalledWith(userId, reservationDate, timePeriod);
    });

    test('should handle partial failures in bulk reservations', async () => {
      const userId = 1;
      const parkingSpaceIds = [1, 2, 3];
      const reservationDate = '2026-12-15';
      const timePeriod = 'morning';
      
      const mockSpaces = [
        new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 }),
        new ParkingSpace({ id: 2, space_number: 'P002', is_active: 0 }), // Inactive space
        new ParkingSpace({ id: 3, space_number: 'P003', is_active: 1 }),
      ];
      
      const mockReservations = [
        new ParkingReservation({ id: 1, user_id: userId, parking_space_id: 1, reservation_date: reservationDate, time_period: timePeriod, status: 'active' }),
        new ParkingReservation({ id: 3, user_id: userId, parking_space_id: 3, reservation_date: reservationDate, time_period: timePeriod, status: 'active' }),
      ];

      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([]);
      mockParkingSpaceRepository.findById = jest.fn()
        .mockResolvedValueOnce(mockSpaces[0])
        .mockResolvedValueOnce(mockSpaces[1])
        .mockResolvedValueOnce(mockSpaces[2]);
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn()
        .mockResolvedValueOnce({ available: true })
        .mockResolvedValueOnce({ available: true });
      mockReservationRepository.create = jest.fn()
        .mockResolvedValueOnce(mockReservations[0])
        .mockResolvedValueOnce(mockReservations[1]);

      const result = await reservationService.createBulkReservations(userId, parkingSpaceIds, reservationDate, timePeriod);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].parkingSpaceId).toBe(2);
      expect(result.failed[0].reason).toContain('not available');
    });

    test('should throw error when user has overlapping reservation', async () => {
      const userId = 1;
      const parkingSpaceIds = [1, 2];
      const reservationDate = '2026-12-15';
      const timePeriod = 'morning';
      const existingReservation = new ParkingReservation({
        id: 2,
        user_id: userId,
        parking_space_id: 5,
        reservation_date: reservationDate,
        time_period: timePeriod,
        status: 'active',
      });

      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([existingReservation]);

      await expect(
        reservationService.createBulkReservations(userId, parkingSpaceIds, reservationDate, timePeriod)
      ).rejects.toThrow('already have a parking reservation');
    });

    test('should throw error when all reservations fail', async () => {
      const userId = 1;
      const parkingSpaceIds = [999, 998]; // Non-existent spaces
      const reservationDate = '2026-12-15';
      const timePeriod = 'morning';

      mockReservationRepository.findOverlappingUserReservations = jest.fn().mockResolvedValue([]);
      mockParkingSpaceRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        reservationService.createBulkReservations(userId, parkingSpaceIds, reservationDate, timePeriod)
      ).rejects.toThrow('Failed to reserve any parking spaces');
    });

    test('should throw error when parkingSpaceIds is empty', async () => {
      await expect(
        reservationService.createBulkReservations(1, [], '2026-12-15', 'morning')
      ).rejects.toThrow('At least one parking space ID is required');
    });

    test('should throw error when reservationDate is missing', async () => {
      await expect(
        reservationService.createBulkReservations(1, [1, 2], null, 'morning')
      ).rejects.toThrow('Reservation date is required');
    });

    test('should throw error when timePeriod is invalid', async () => {
      await expect(
        reservationService.createBulkReservations(1, [1, 2], '2026-12-15', 'invalid')
      ).rejects.toThrow('Time period must be morning, afternoon, or full_day');
    });
  });
});

