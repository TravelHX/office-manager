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
  let mockFobInventoryService;

  beforeEach(() => {
    mockBookingRepository = new BookingRepository();
    mockDeskRepository = new DeskRepository();
    mockDeskService = new DeskService();
    bookingService = new BookingService();
    bookingService.bookingRepository = mockBookingRepository;
    bookingService.deskRepository = mockDeskRepository;
    bookingService.deskService = mockDeskService;
    // Phase 27b: inventory enforcement is delegated to FobInventoryService.
    // The default mock simulates "no inventory configured" so existing
    // tests stay unaffected; individual tests override as needed.
    mockFobInventoryService = {
      getEffectiveCountForDate: jest.fn().mockResolvedValue(null),
      countActiveFobBookingsForDate: jest.fn().mockResolvedValue(0),
    };
    bookingService.fobInventoryService = mockFobInventoryService;
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
      // createBooking now checks user-overlap first; mock returns no overlap
      // so we reach the desk-availability branch this test is asserting.
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
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

    // Phase 27a: createBooking forwards the optional `fobRequested` flag
    // through to the Booking model, where it lands as `fob_requested` in
    // the database row. No inventory enforcement happens at this layer
    // yet (Phase 27b adds that); this test only pins the storage path.
    test('forwards fobRequested = true into the new Booking row', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2099-09-09';
      const endDate = '2099-09-09';
      const mockDesk = new Desk({ id: deskId, desk_number: 'D001', is_active: 1 });
      const mockBooking = new Booking({
        id: 42,
        user_id: userId,
        desk_id: deskId,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        fob_requested: 1,
      });

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true });
      mockBookingRepository.create = jest.fn().mockResolvedValue(mockBooking);

      const result = await bookingService.createBooking(userId, deskId, startDate, endDate, {
        fobRequested: true,
      });

      expect(result.fobRequested).toBe(true);
      // The Booking instance handed to the repository must carry the flag.
      const passed = mockBookingRepository.create.mock.calls[0][0];
      expect(passed.fobRequested).toBe(true);
    });

    test('defaults fobRequested to false when the option is omitted', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2099-09-09';
      const endDate = '2099-09-09';
      const mockDesk = new Desk({ id: deskId, desk_number: 'D001', is_active: 1 });
      const mockBooking = new Booking({
        id: 43,
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

      await bookingService.createBooking(userId, deskId, startDate, endDate);

      const passed = mockBookingRepository.create.mock.calls[0][0];
      expect(passed.fobRequested).toBe(false);
    });

    // Phase 27b enforcement tests. The service consults
    // FobInventoryService for every day in the requested range when
    // fobRequested === true; if any day's available count is <= 0 the
    // call rejects with `FOB_UNAVAILABLE` and the offending date is
    // identifiable from the error.
    test('rejects with FOB_UNAVAILABLE when any day has no remaining inventory', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2099-09-09';
      const endDate = '2099-09-10';
      const mockDesk = new Desk({ id: deskId, desk_number: 'D001', is_active: 1 });

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true });
      // Day 1 has 1 fob configured, 0 used (1 available); day 2 has 1
      // fob configured, 1 already used (0 available). The booking spans
      // both days so it should reject on day 2.
      mockFobInventoryService.getEffectiveCountForDate = jest.fn(async (date) => 1);
      mockFobInventoryService.countActiveFobBookingsForDate = jest.fn(async (date) =>
        date === '2099-09-10' ? 1 : 0
      );

      await expect(
        bookingService.createBooking(userId, deskId, startDate, endDate, { fobRequested: true })
      ).rejects.toThrow(/FOB_UNAVAILABLE/);
    });

    test('allows the booking when no inventory is configured (effective count null)', async () => {
      const userId = 1;
      const deskId = 1;
      const startDate = '2099-09-09';
      const endDate = '2099-09-09';
      const mockDesk = new Desk({ id: deskId, desk_number: 'D001', is_active: 1 });
      const mockBooking = new Booking({
        id: 80,
        user_id: userId,
        desk_id: deskId,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        fob_requested: 1,
      });

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true });
      mockBookingRepository.create = jest.fn().mockResolvedValue(mockBooking);
      // null === inventory not configured for that day; spec says fob
      // requests are TRACKED but never blocked when no inventory is set.
      mockFobInventoryService.getEffectiveCountForDate = jest.fn().mockResolvedValue(null);

      const result = await bookingService.createBooking(userId, deskId, startDate, endDate, {
        fobRequested: true,
      });

      expect(result.fobRequested).toBe(true);
      expect(mockBookingRepository.create).toHaveBeenCalled();
      // countActiveFobBookingsForDate should not even be queried when
      // configured is null — there's nothing to enforce against.
      expect(mockFobInventoryService.countActiveFobBookingsForDate).not.toHaveBeenCalled();
    });

    test('exposes offending date(s) on FOB_UNAVAILABLE error', async () => {
      const userId = 1;
      const deskId = 1;
      const mockDesk = new Desk({ id: deskId, desk_number: 'D001', is_active: 1 });

      mockDeskRepository.findById = jest.fn().mockResolvedValue(mockDesk);
      mockBookingRepository.findOverlappingUserBookings = jest.fn().mockResolvedValue([]);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true });
      mockFobInventoryService.getEffectiveCountForDate = jest.fn().mockResolvedValue(1);
      mockFobInventoryService.countActiveFobBookingsForDate = jest.fn(async (date) =>
        date === '2099-09-09' ? 1 : 0
      );

      let thrown;
      try {
        await bookingService.createBooking(userId, deskId, '2099-09-08', '2099-09-10', {
          fobRequested: true,
        });
      } catch (err) {
        thrown = err;
      }
      expect(thrown).toBeDefined();
      expect(thrown.code).toBe('FOB_UNAVAILABLE');
      // The error carries an offendingDates array (sorted ascending) so
      // route handlers can include it in the API response.
      expect(thrown.offendingDates).toEqual(['2099-09-09']);
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

  describe('restoreCancelledBooking (Phase 23c undo)', () => {
    // Capture the canonical window so tests stay in sync with the source.
    const UNDO_WINDOW_MS = BookingService.UNDO_CANCEL_WINDOW_MS;
    const USER_ID = 7;
    const DESK_ID = 42;
    const BOOKING_ID = 100;

    function cancelledBookingFixture(overrides = {}) {
      const base = {
        id: BOOKING_ID,
        user_id: USER_ID,
        desk_id: DESK_ID,
        start_date: '2099-01-01',
        end_date: '2099-01-01',
        status: 'cancelled',
        cancelled_by: USER_ID,
        cancelled_at: new Date('2026-06-01T12:00:00Z'),
      };
      return new Booking({ ...base, ...overrides });
    }

    test('restores booking inside window when desk is still available', async () => {
      const cancelled = cancelledBookingFixture();
      mockBookingRepository.findById = jest.fn().mockResolvedValue(cancelled);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({ available: true, conflicts: [] });
      const restored = new Booking({ ...cancelled.toJSON(), status: 'active', cancelled_at: null, cancelled_by: null });
      // toJSON uses camelCase keys; the Booking constructor expects snake_case.
      // Re-seed the restored row from a snake_case shape.
      mockBookingRepository.restore = jest.fn().mockResolvedValue(new Booking({
        id: BOOKING_ID,
        user_id: USER_ID,
        desk_id: DESK_ID,
        start_date: '2099-01-01',
        end_date: '2099-01-01',
        status: 'active',
      }));

      // `now` is one millisecond before the window closes so we're still allowed.
      const nowJustInside = new Date(cancelled.cancelledAt.getTime() + UNDO_WINDOW_MS - 1);
      const result = await bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID, nowJustInside);

      expect(result.status).toBe('active');
      expect(mockDeskService.checkDeskAvailability).toHaveBeenCalledWith(
        DESK_ID,
        '2099-01-01',
        '2099-01-01',
        BOOKING_ID,
      );
      expect(mockBookingRepository.restore).toHaveBeenCalledWith(BOOKING_ID);
    });

    test('rejects when booking is not found', async () => {
      mockBookingRepository.findById = jest.fn().mockResolvedValue(null);
      await expect(
        bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID)
      ).rejects.toThrow('Booking not found');
    });

    test('rejects when another user attempts to undo', async () => {
      mockBookingRepository.findById = jest.fn().mockResolvedValue(cancelledBookingFixture());
      await expect(
        bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID + 1)
      ).rejects.toThrow('only undo your own');
    });

    test('rejects when booking is still active (nothing to undo)', async () => {
      const active = cancelledBookingFixture({ status: 'active', cancelled_by: null, cancelled_at: null });
      mockBookingRepository.findById = jest.fn().mockResolvedValue(active);
      await expect(
        bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID)
      ).rejects.toThrow('Booking is not cancelled');
    });

    test('rejects admin-cancelled booking (self-cancel only)', async () => {
      const adminCancelled = cancelledBookingFixture({ cancelled_by: 999 });
      mockBookingRepository.findById = jest.fn().mockResolvedValue(adminCancelled);
      await expect(
        bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID)
      ).rejects.toThrow('Only self-cancellations can be undone');
    });

    test('rejects when undo window has expired', async () => {
      const cancelled = cancelledBookingFixture();
      mockBookingRepository.findById = jest.fn().mockResolvedValue(cancelled);
      const nowTooLate = new Date(cancelled.cancelledAt.getTime() + UNDO_WINDOW_MS + 1);
      await expect(
        bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID, nowTooLate)
      ).rejects.toThrow('Undo window has expired');
    });

    test('rejects when desk is no longer available', async () => {
      const cancelled = cancelledBookingFixture();
      mockBookingRepository.findById = jest.fn().mockResolvedValue(cancelled);
      mockDeskService.checkDeskAvailability = jest.fn().mockResolvedValue({
        available: false,
        conflicts: [{ id: 200 }],
      });
      const nowInside = new Date(cancelled.cancelledAt.getTime() + 1000);
      await expect(
        bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID, nowInside)
      ).rejects.toThrow('no longer available');
    });

    test('treats missing cancelled_at as an expired window (defensive)', async () => {
      const weird = cancelledBookingFixture({ cancelled_at: null });
      mockBookingRepository.findById = jest.fn().mockResolvedValue(weird);
      await expect(
        bookingService.restoreCancelledBooking(BOOKING_ID, USER_ID)
      ).rejects.toThrow('Undo window has expired');
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

