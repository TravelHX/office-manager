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
      const startDate = '2025-01-01';
      const endDate = '2025-01-02';
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
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true });
      mockBookingRepository.create = jest.fn().mockResolvedValue(mockBooking);

      const result = await bookingService.createBooking(userId, deskId, startDate, endDate);

      expect(result).toEqual(mockBooking);
      expect(mockDeskRepository.findById).toHaveBeenCalledWith(deskId);
      expect(mockDeskService.checkDeskAvailability).toHaveBeenCalledWith(deskId, startDate, endDate);
    });

    test('should throw error when desk not found', async () => {
      mockDeskRepository.findById = jest.fn().mockResolvedValue(null);

      await expect(
        bookingService.createBooking(1, 999, '2025-01-01', '2025-01-02')
      ).rejects.toThrow('Desk not found');
    });

    test('should throw error when desk not available', async () => {
      const mockDesk = new Desk({ id: 1, desk_number: 'D001', is_active: 1 });
      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: false });

      await expect(
        bookingService.createBooking(1, 1, '2025-01-01', '2025-01-02')
      ).rejects.toThrow('not available');
    });

    test('should throw error when start date is after end date', async () => {
      await expect(
        bookingService.createBooking(1, 1, '2025-01-02', '2025-01-01')
      ).rejects.toThrow('Start date must be before');
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
});

