const MatrixService = require('../../src/backend/services/MatrixService');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');
const UserRepository = require('../../src/backend/repositories/UserRepository');

jest.mock('../../src/backend/repositories/BookingRepository');
jest.mock('../../src/backend/repositories/ParkingReservationRepository');
jest.mock('../../src/backend/repositories/UserRepository');

describe('MatrixService', () => {
  let matrixService;
  let mockBookingRepository;
  let mockReservationRepository;
  let mockUserRepository;

  beforeEach(() => {
    matrixService = new MatrixService();
    mockBookingRepository = matrixService.bookingRepository;
    mockReservationRepository = matrixService.reservationRepository;
    mockUserRepository = matrixService.userRepository;
  });

  describe('generateDateRange', () => {
    test('should generate date range correctly', () => {
      const startDate = '2025-12-01';
      const endDate = '2025-12-05';
      const dates = matrixService.generateDateRange(startDate, endDate);
      
      expect(dates).toEqual([
        '2025-12-01',
        '2025-12-02',
        '2025-12-03',
        '2025-12-04',
        '2025-12-05',
      ]);
    });

    test('should handle single day range', () => {
      const startDate = '2025-12-01';
      const endDate = '2025-12-01';
      const dates = matrixService.generateDateRange(startDate, endDate);
      
      expect(dates).toEqual(['2025-12-01']);
    });

    test('should throw error if start date is after end date', () => {
      const startDate = '2025-12-05';
      const endDate = '2025-12-01';
      
      expect(() => {
        matrixService.generateDateRange(startDate, endDate);
      }).toThrow('Start date must be before or equal to end date');
    });

    test('should throw error for invalid date format', () => {
      const startDate = 'invalid-date';
      const endDate = '2025-12-01';
      
      expect(() => {
        matrixService.generateDateRange(startDate, endDate);
      }).toThrow('Invalid date format');
    });
  });

  describe('getMatrixData', () => {
    const mockUsers = [
      { id: 1, username: 'user1', email: 'user1@example.com', role: 'user' },
      { id: 2, username: 'user2', email: 'user2@example.com', role: 'user' },
    ];

    const mockDeskBookings = [
      {
        id: 1,
        user_id: 1,
        desk_id: 1,
        start_date: '2025-12-01',
        end_date: '2025-12-03',
        status: 'active',
        desk_number: 'D001',
        location: 'Office A',
        username: 'user1',
      },
    ];

    const mockParkingReservations = [
      {
        id: 1,
        user_id: 1,
        parking_space_id: 1,
        reservation_date: '2025-12-02',
        time_period: 'morning',
        status: 'active',
        space_number: 'P001',
        location: 'Parking Lot',
        username: 'user1',
      },
    ];

    beforeEach(() => {
      mockUserRepository.findAll = jest.fn().mockResolvedValue(mockUsers);
      mockUserRepository.findById = jest.fn().mockImplementation((id) => {
        return Promise.resolve(mockUsers.find(u => u.id === id) || null);
      });
      mockBookingRepository.executeRawQuery = jest.fn().mockResolvedValue(mockDeskBookings);
      mockReservationRepository.executeRawQuery = jest.fn().mockResolvedValue(mockParkingReservations);
    });

    test('should return matrix data with combined view', async () => {
      const result = await matrixService.getMatrixData({
        startDate: '2025-12-01',
        endDate: '2025-12-03',
        type: 'combined',
      });

      expect(result).toHaveProperty('dateRange');
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('data');
      expect(result.dateRange).toEqual(['2025-12-01', '2025-12-02', '2025-12-03']);
      expect(result.users).toHaveLength(2);
      expect(result.data[1]['2025-12-01'].deskBookings).toHaveLength(1);
      expect(result.data[1]['2025-12-02'].parkingReservations).toHaveLength(1);
    });

    test('should return matrix data with desks only view', async () => {
      const result = await matrixService.getMatrixData({
        startDate: '2025-12-01',
        endDate: '2025-12-03',
        type: 'desks',
      });

      expect(result.data[1]['2025-12-01'].deskBookings).toHaveLength(1);
      expect(result.data[1]['2025-12-02'].parkingReservations).toHaveLength(0);
    });

    test('should return matrix data with parking only view', async () => {
      const result = await matrixService.getMatrixData({
        startDate: '2025-12-01',
        endDate: '2025-12-03',
        type: 'parking',
      });

      expect(result.data[1]['2025-12-01'].deskBookings).toHaveLength(0);
      expect(result.data[1]['2025-12-02'].parkingReservations).toHaveLength(1);
    });

    test('should filter by user IDs', async () => {
      await matrixService.getMatrixData({
        startDate: '2025-12-01',
        endDate: '2025-12-03',
        userIds: [1],
        type: 'combined',
      });

      expect(mockUserRepository.findById).toHaveBeenCalledWith(1);
      expect(mockBookingRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id IN'),
        expect.arrayContaining([1])
      );
    });

    test('should filter by desk IDs', async () => {
      await matrixService.getMatrixData({
        startDate: '2025-12-01',
        endDate: '2025-12-03',
        deskIds: [1],
        type: 'combined',
      });

      expect(mockBookingRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('desk_id IN'),
        expect.arrayContaining([1])
      );
    });

    test('should filter by parking space IDs', async () => {
      await matrixService.getMatrixData({
        startDate: '2025-12-01',
        endDate: '2025-12-03',
        parkingSpaceIds: [1],
        type: 'combined',
      });

      expect(mockReservationRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('parking_space_id IN'),
        expect.arrayContaining([1])
      );
    });

    test('should expand multi-day bookings across date range', async () => {
      const result = await matrixService.getMatrixData({
        startDate: '2025-12-01',
        endDate: '2025-12-05',
        type: 'combined',
      });

      // Booking spans 2025-12-01 to 2025-12-03, so should appear in all three days
      expect(result.data[1]['2025-12-01'].deskBookings).toHaveLength(1);
      expect(result.data[1]['2025-12-02'].deskBookings).toHaveLength(1);
      expect(result.data[1]['2025-12-03'].deskBookings).toHaveLength(1);
      expect(result.data[1]['2025-12-04'].deskBookings).toHaveLength(0);
    });

    test('should throw error if start date or end date is missing', async () => {
      await expect(
        matrixService.getMatrixData({
          startDate: '2025-12-01',
          type: 'combined',
        })
      ).rejects.toThrow('Start date and end date are required');

      await expect(
        matrixService.getMatrixData({
          endDate: '2025-12-01',
          type: 'combined',
        })
      ).rejects.toThrow('Start date and end date are required');
    });
  });

  describe('getDeskBookingsForDateRange', () => {
    const mockBookings = [
      {
        id: 1,
        user_id: 1,
        desk_id: 1,
        start_date: '2025-12-01',
        end_date: '2025-12-03',
        status: 'active',
        desk_number: 'D001',
        location: 'Office A',
        username: 'user1',
      },
    ];

    beforeEach(() => {
      mockBookingRepository.executeRawQuery = jest.fn().mockResolvedValue(mockBookings);
    });

    test('should retrieve desk bookings for date range', async () => {
      const result = await matrixService.getDeskBookingsForDateRange(
        '2025-12-01',
        '2025-12-03'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('userId', 1);
      expect(result[0]).toHaveProperty('deskId', 1);
      expect(result[0]).toHaveProperty('deskNumber', 'D001');
    });

    test('should filter by user IDs', async () => {
      await matrixService.getDeskBookingsForDateRange(
        '2025-12-01',
        '2025-12-03',
        [1, 2]
      );

      expect(mockBookingRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id IN'),
        expect.arrayContaining([1, 2])
      );
    });

    test('should filter by desk IDs', async () => {
      await matrixService.getDeskBookingsForDateRange(
        '2025-12-01',
        '2025-12-03',
        null,
        [1, 2]
      );

      expect(mockBookingRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('desk_id IN'),
        expect.arrayContaining([1, 2])
      );
    });
  });

  describe('getParkingReservationsForDateRange', () => {
    const mockReservations = [
      {
        id: 1,
        user_id: 1,
        parking_space_id: 1,
        reservation_date: '2025-12-02',
        time_period: 'morning',
        status: 'active',
        space_number: 'P001',
        location: 'Parking Lot',
        username: 'user1',
      },
    ];

    beforeEach(() => {
      mockReservationRepository.executeRawQuery = jest.fn().mockResolvedValue(mockReservations);
    });

    test('should retrieve parking reservations for date range', async () => {
      const result = await matrixService.getParkingReservationsForDateRange(
        '2025-12-01',
        '2025-12-03'
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('userId', 1);
      expect(result[0]).toHaveProperty('parkingSpaceId', 1);
      expect(result[0]).toHaveProperty('spaceNumber', 'P001');
      expect(result[0]).toHaveProperty('timePeriod', 'morning');
    });

    test('should filter by user IDs', async () => {
      await matrixService.getParkingReservationsForDateRange(
        '2025-12-01',
        '2025-12-03',
        [1, 2]
      );

      expect(mockReservationRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('user_id IN'),
        expect.arrayContaining([1, 2])
      );
    });

    test('should filter by parking space IDs', async () => {
      await matrixService.getParkingReservationsForDateRange(
        '2025-12-01',
        '2025-12-03',
        null,
        [1, 2]
      );

      expect(mockReservationRepository.executeRawQuery).toHaveBeenCalledWith(
        expect.stringContaining('parking_space_id IN'),
        expect.arrayContaining([1, 2])
      );
    });
  });
});

