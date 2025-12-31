const AdminService = require('../../src/backend/services/AdminService');
const AdminConfigurationRepository = require('../../src/backend/repositories/AdminConfigurationRepository');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const ParkingSpaceRepository = require('../../src/backend/repositories/ParkingSpaceRepository');
const ParkingReservationRepository = require('../../src/backend/repositories/ParkingReservationRepository');
const Desk = require('../../src/backend/models/Desk');
const ParkingSpace = require('../../src/backend/models/ParkingSpace');
const Booking = require('../../src/backend/models/Booking');

jest.mock('../../src/backend/repositories/AdminConfigurationRepository');
jest.mock('../../src/backend/repositories/DeskRepository');
jest.mock('../../src/backend/repositories/BookingRepository');
jest.mock('../../src/backend/repositories/ParkingSpaceRepository');
jest.mock('../../src/backend/repositories/ParkingReservationRepository');

describe('AdminService', () => {
  let adminService;
  let mockConfigRepository;
  let mockDeskRepository;
  let mockBookingRepository;
  let mockParkingSpaceRepository;
  let mockReservationRepository;

  beforeEach(() => {
    mockConfigRepository = new AdminConfigurationRepository();
    mockDeskRepository = new DeskRepository();
    mockBookingRepository = new BookingRepository();
    mockParkingSpaceRepository = new ParkingSpaceRepository();
    mockReservationRepository = new ParkingReservationRepository();
    
    adminService = new AdminService();
    adminService.configRepository = mockConfigRepository;
    adminService.deskRepository = mockDeskRepository;
    adminService.bookingRepository = mockBookingRepository;
    adminService.parkingSpaceRepository = mockParkingSpaceRepository;
    adminService.reservationRepository = mockReservationRepository;
  });

  describe('getConfiguration', () => {
    test('should return current configuration', async () => {
      mockConfigRepository.getDeskCount = jest.fn().mockResolvedValue(10);
      mockConfigRepository.getParkingCount = jest.fn().mockResolvedValue(5);

      const result = await adminService.getConfiguration();

      expect(result).toEqual({ deskCount: 10, parkingCount: 5 });
      expect(mockConfigRepository.getDeskCount).toHaveBeenCalled();
      expect(mockConfigRepository.getParkingCount).toHaveBeenCalled();
    });
  });

  describe('updateDeskCount', () => {
    test('should update desk count successfully', async () => {
      const mockDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
      ];
      const mockBookings = [];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(mockDesks);
      mockBookingRepository.findAll = jest.fn().mockResolvedValue(mockBookings);
      mockConfigRepository.setDeskCount = jest.fn().mockResolvedValue(null);
      mockConfigRepository.getDeskCount = jest.fn().mockResolvedValue(5);
      mockConfigRepository.getParkingCount = jest.fn().mockResolvedValue(3);

      const result = await adminService.updateDeskCount(5);

      expect(result.deskCount).toBe(5);
      expect(mockConfigRepository.setDeskCount).toHaveBeenCalledWith(5);
    });

    test('should throw error when reducing below active desks', async () => {
      const mockDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
      ];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(mockDesks);
      mockBookingRepository.findAll = jest.fn().mockResolvedValue([]);

      await expect(adminService.updateDeskCount(1)).rejects.toThrow('Cannot reduce desk count below 2');
    });

    test('should throw error when reducing below desks with active bookings', async () => {
      const mockDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
      ];
      const mockBookings = [
        new Booking({ id: 1, desk_id: 1, status: 'active' }),
        new Booking({ id: 2, desk_id: 2, status: 'active' }),
      ];

      mockDeskRepository.findAllActive = jest.fn().mockResolvedValue(mockDesks);
      mockBookingRepository.findAll = jest.fn().mockResolvedValue(mockBookings);

      await expect(adminService.updateDeskCount(1)).rejects.toThrow('Cannot reduce desk count below 2');
    });

    test('should throw error for negative count', async () => {
      await expect(adminService.updateDeskCount(-1)).rejects.toThrow('Desk count cannot be negative');
    });

    test('should throw error for non-integer count', async () => {
      await expect(adminService.updateDeskCount(5.5)).rejects.toThrow('Desk count must be an integer');
    });
  });

  describe('updateParkingCount', () => {
    test('should update parking count successfully', async () => {
      const mockSpaces = [
        new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 }),
      ];
      const mockReservations = [];

      mockParkingSpaceRepository.findAllActive = jest.fn().mockResolvedValue(mockSpaces);
      mockReservationRepository.findAll = jest.fn().mockResolvedValue(mockReservations);
      mockConfigRepository.setParkingCount = jest.fn().mockResolvedValue(null);
      mockConfigRepository.getDeskCount = jest.fn().mockResolvedValue(5);
      mockConfigRepository.getParkingCount = jest.fn().mockResolvedValue(3);

      const result = await adminService.updateParkingCount(3);

      expect(result.parkingCount).toBe(3);
      expect(mockConfigRepository.setParkingCount).toHaveBeenCalledWith(3);
    });

    test('should throw error when reducing below active spaces', async () => {
      const mockSpaces = [
        new ParkingSpace({ id: 1, space_number: 'P001', is_active: 1 }),
        new ParkingSpace({ id: 2, space_number: 'P002', is_active: 1 }),
      ];

      mockParkingSpaceRepository.findAllActive = jest.fn().mockResolvedValue(mockSpaces);
      mockReservationRepository.findAll = jest.fn().mockResolvedValue([]);

      await expect(adminService.updateParkingCount(1)).rejects.toThrow('Cannot reduce parking count below 2');
    });

    test('should throw error for negative count', async () => {
      await expect(adminService.updateParkingCount(-1)).rejects.toThrow('Parking count cannot be negative');
    });
  });

  describe('getAllBookings', () => {
    test('should return all bookings', async () => {
      const mockBookings = [
        { id: 1, deskId: 1, userId: 1, status: 'active' },
        { id: 2, deskId: 2, userId: 2, status: 'active' },
      ];

      mockBookingRepository.findAll = jest.fn().mockResolvedValue(mockBookings);

      const result = await adminService.getAllBookings();

      expect(result).toEqual(mockBookings);
      expect(mockBookingRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('getAllParkingReservations', () => {
    test('should return all parking reservations', async () => {
      const mockReservations = [
        { id: 1, parkingSpaceId: 1, userId: 1, status: 'active' },
      ];

      mockReservationRepository.findAll = jest.fn().mockResolvedValue(mockReservations);

      const result = await adminService.getAllParkingReservations();

      expect(result).toEqual(mockReservations);
      expect(mockReservationRepository.findAll).toHaveBeenCalled();
    });
  });
});

