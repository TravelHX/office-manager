const BookingService = require('../../src/backend/services/BookingService');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');
const DeskRepository = require('../../src/backend/repositories/DeskRepository');
const DeskService = require('../../src/backend/services/DeskService');
const Booking = require('../../src/backend/models/Booking');
const Desk = require('../../src/backend/models/Desk');

jest.mock('../../src/backend/repositories/BookingRepository');
jest.mock('../../src/backend/repositories/DeskRepository');
jest.mock('../../src/backend/services/DeskService');

describe('BookingService', () => {
  let bookingService;
  let mockBookingRepository;
  let mockDeskRepository;
  let mockDeskService;

  beforeEach(() => {
    mockBookingRepository = new BookingRepository();
    mockDeskRepository = new DeskRepository();
    mockDeskService = new DeskService();
    bookingService = new BookingService();
    bookingService.bookingRepository = mockBookingRepository;
    bookingService.deskRepository = mockDeskRepository;
    bookingService.deskService = mockDeskService;
  });

  describe('createBooking', () => {
    test('should create booking successfully', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2026-12-15';
      const endDate = '2026-12-16';
      const mockDesk = new Desk({ id: 1, desk_number: 'D001', is_active: 1 });
      const mockBooking = new Booking({
        id: 1,
        user_id: userId,
        desk_id: deskId,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
      });

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true });
      mockBookingRepository.create = jest.fn().mockResolvedValue(mockBooking);

      const result = await bookingService.createBooking(userId, deskId, startDate, endDate);

      expect(result).toEqual(mockBooking);
      expect(mockDeskRepository.findById).toHaveBeenCalledWith(deskId);
      expect(mockBookingRepository.findOverlappingUserBookings).toHaveBeenCalledWith(userId, startDate, endDate);
      expect(mockDeskService.checkDeskAvailability).toHaveBeenCalledWith(deskId, startDate, endDate);
    });

    test('should throw error when desk not found', async () => {
      mockDeskRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        bookingService.createBooking(1, 999, '2026-12-15', '2026-12-16')
      ).rejects.toThrow('Desk not found');
    });

    test('should throw error when desk not available', async () => {
      const mockDesk = new Desk({ id: 1, desk_number: 'D001', is_active: 1 });
      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: false });

      await expect(
        bookingService.createBooking(1, 1, '2026-12-15', '2026-12-16')
      ).rejects.toThrow('not available');
    });

    test('should throw error when start date is after end date', async () => {
      await expect(
        bookingService.createBooking(1, 1, '2026-12-16', '2026-12-15')
      ).rejects.toThrow('Start date must be before');
    });

    test('should throw error when user has overlapping desk booking', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2026-12-15';
      const endDate = '2026-12-16';
      const mockDesk = new Desk({ id: 1, desk_number: 'D001', is_active: 1 });
      const existingBooking = new Booking({
        id: 2,
        user_id: userId,
        desk_id: 2,
        start_date: '2026-12-14',
        end_date: '2026-12-17',
        status: 'active',
      });

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([existingBooking]);

      await expect(
        bookingService.createBooking(userId, deskId, startDate, endDate)
      ).rejects.toThrow('already have a desk booking');
    });

    test('should throw error when desk is already booked by another user', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2026-12-15';
      const endDate = '2026-12-16';
      const mockDesk = new Desk({ id: 1, desk_number: 'D001', is_active: 1 });
      const conflict = {
        id: 2,
        userId: 2,
        deskId: deskId,
        startDate: '2026-12-14',
        endDate: '2026-12-17',
        status: 'active',
      };

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({
        available: false,
        conflicts: [conflict],
      });

      await expect(
        bookingService.createBooking(userId, deskId, startDate, endDate)
      ).rejects.toThrow('already booked by another user');
    });

    test('should handle partial date range overlaps correctly', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2026-12-15';
      const endDate = '2026-12-20';
      const mockDesk = new Desk({ id: 1, desk_number: 'D001', is_active: 1 });
      // Existing booking overlaps partially (Jan 18-22 overlaps with Jan 15-20)
      const existingBooking = new Booking({
        id: 2,
        user_id: userId,
        desk_id: 2,
        start_date: '2026-12-18',
        end_date: '2026-12-22',
        status: 'active',
      });

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([existingBooking]);

      await expect(
        bookingService.createBooking(userId, deskId, startDate, endDate)
      ).rejects.toThrow('already have a desk booking');
    });
  });

  describe('cancelUserBooking', () => {
    test('should cancel booking successfully', async () => {
      const bookingId = 1;
      const userId = 1;
      const mockBooking = new Booking({
        id: bookingId,
        user_id: userId,
        desk_id: 1,
        status: 'active',
      });

      mockBookingRepository.findById = jest.fn().mockResolvedValue(mockBooking);
      mockBookingRepository.cancel = jest.fn().mockResolvedValue(mockBooking);

      await bookingService.cancelUserBooking(bookingId, userId);

      expect(mockBookingRepository.cancel).toHaveBeenCalledWith(bookingId, userId, null);
    });

    test('should throw error when user tries to cancel another user booking', async () => {
      const mockBooking = new Booking({
        id: 1,
        user_id: 1,
        desk_id: 1,
        status: 'active',
      });

      mockBookingRepository.findById = jest.fn().mockResolvedValue(mockBooking);

      await expect(
        bookingService.cancelUserBooking(1, 2)
      ).rejects.toThrow('only cancel your own');
    });
  });

  describe('createBulkBookings', () => {
    test('should create multiple bookings successfully', async () => {
      const userId = 1;
      const deskIds = [1, 2, 3];
      const startDate = '2026-12-15';
      const endDate = '2026-12-16';
      
      const mockDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 1 }),
        new Desk({ id: 3, desk_number: 'D003', is_active: 1 }),
      ];
      
      const mockBookings = [
        new Booking({ id: 1, user_id: userId, desk_id: 1, start_date: startDate, end_date: endDate, status: 'active' }),
        new Booking({ id: 2, user_id: userId, desk_id: 2, start_date: startDate, end_date: endDate, status: 'active' }),
        new Booking({ id: 3, user_id: userId, desk_id: 3, start_date: startDate, end_date: endDate, status: 'active' }),
      ];

      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskRepository.findById = jest.fn()
        .mockResolvedValueOnce(mockDesks[0])
        .mockResolvedValueOnce(mockDesks[1])
        .mockResolvedValueOnce(mockDesks[2]);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true });
      mockBookingRepository.create = jest.fn()
        .mockResolvedValueOnce(mockBookings[0])
        .mockResolvedValueOnce(mockBookings[1])
        .mockResolvedValueOnce(mockBookings[2]);

      const result = await bookingService.createBulkBookings(userId, deskIds, startDate, endDate);

      expect(result.successful).toHaveLength(3);
      expect(result.failed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
      expect(mockBookingRepository.findOverlappingUserBookings).toHaveBeenCalledWith(userId, startDate, endDate);
    });

    test('should handle partial failures in bulk bookings', async () => {
      const userId = 1;
      const deskIds = [1, 2, 3];
      const startDate = '2026-12-15';
      const endDate = '2026-12-16';
      
      const mockDesks = [
        new Desk({ id: 1, desk_number: 'D001', is_active: 1 }),
        new Desk({ id: 2, desk_number: 'D002', is_active: 0 }), // Inactive desk
        new Desk({ id: 3, desk_number: 'D003', is_active: 1 }),
      ];
      
      const mockBookings = [
        new Booking({ id: 1, user_id: userId, desk_id: 1, start_date: startDate, end_date: endDate, status: 'active' }),
        new Booking({ id: 3, user_id: userId, desk_id: 3, start_date: startDate, end_date: endDate, status: 'active' }),
      ];

      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskRepository.findById = jest.fn()
        .mockResolvedValueOnce(mockDesks[0])
        .mockResolvedValueOnce(mockDesks[1])
        .mockResolvedValueOnce(mockDesks[2]);
      mockDeskService.checkDeskAvailability = jest.fn()
        .mockResolvedValueOnce({ available: true })
        .mockResolvedValueOnce({ available: true });
      mockBookingRepository.create = jest.fn()
        .mockResolvedValueOnce(mockBookings[0])
        .mockResolvedValueOnce(mockBookings[1]);

      const result = await bookingService.createBulkBookings(userId, deskIds, startDate, endDate);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].deskId).toBe(2);
      expect(result.failed[0].reason).toContain('not available');
    });

    test('should throw error when user has overlapping booking', async () => {
      const userId = 1;
      const deskIds = [1, 2];
      const startDate = '2026-12-15';
      const endDate = '2026-12-16';
      const existingBooking = new Booking({
        id: 2,
        user_id: userId,
        desk_id: 5,
        start_date: '2026-12-14',
        end_date: '2026-12-17',
        status: 'active',
      });

      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([existingBooking]);

      await expect(
        bookingService.createBulkBookings(userId, deskIds, startDate, endDate)
      ).rejects.toThrow('already have a desk booking');
    });

    test('should throw error when all bookings fail', async () => {
      const userId = 1;
      const deskIds = [999, 998]; // Non-existent desks
      const startDate = '2026-12-15';
      const endDate = '2026-12-16';

      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        bookingService.createBulkBookings(userId, deskIds, startDate, endDate)
      ).rejects.toThrow('Failed to book any desks');
    });

    test('should throw error when deskIds is empty', async () => {
      await expect(
        bookingService.createBulkBookings(1, [], '2026-12-15', '2026-12-16')
      ).rejects.toThrow('At least one desk ID is required');
    });

    test('should throw error when dates are missing', async () => {
      await expect(
        bookingService.createBulkBookings(1, [1, 2], null, '2026-12-16')
      ).rejects.toThrow('Start date and end date are required');
    });
  });
});

