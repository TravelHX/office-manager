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
      const reservationDate = '2025-01-01';
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
      mockParkingSpaceService.checkParkingSpaceAvailability = jest.fn().mockResolvedValue({ available: true });
      mockReservationRepository.create = jest.fn().mockResolvedValue(mockReservation);

      const result = await reservationService.createReservation(userId, parkingSpaceId, reservationDate, timePeriod);

      expect(result).toEqual(mockReservation);
      expect(mockParkingSpaceRepository.findById).toHaveBeenCalledWith(parkingSpaceId);
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
});

