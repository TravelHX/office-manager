// Phase 27b: FobInventoryService unit tests.
//
// The service owns:
//   - default vs override resolution
//   - validation (count >= 0, parseable date)
//   - per-day availability over a date range, computed as
//     configured - active fob bookings overlapping the day
//
// All DB access is delegated to FobInventoryRepository and
// BookingRepository, both mocked here.

const FobInventoryService = require('../../src/backend/services/FobInventoryService');
const FobInventoryRepository = require('../../src/backend/repositories/FobInventoryRepository');
const BookingRepository = require('../../src/backend/repositories/BookingRepository');

jest.mock('../../src/backend/repositories/FobInventoryRepository');
jest.mock('../../src/backend/repositories/BookingRepository');

describe('FobInventoryService', () => {
  let svc;
  let mockFobRepo;
  let mockBookingRepo;

  beforeEach(() => {
    mockFobRepo = new FobInventoryRepository();
    mockBookingRepo = new BookingRepository();
    svc = new FobInventoryService();
    svc.fobInventoryRepository = mockFobRepo;
    svc.bookingRepository = mockBookingRepo;
  });

  describe('getDefault', () => {
    test('returns the count when a default row exists', async () => {
      mockFobRepo.getDefault = jest.fn().mockResolvedValue({ count: 5 });
      await expect(svc.getDefault()).resolves.toBe(5);
    });

    test('returns null when no default row exists', async () => {
      mockFobRepo.getDefault = jest.fn().mockResolvedValue(null);
      await expect(svc.getDefault()).resolves.toBeNull();
    });
  });

  describe('getOverrideForDate', () => {
    test('returns the override count for that date', async () => {
      mockFobRepo.getOverrideForDate = jest.fn().mockResolvedValue({ count: 2 });
      await expect(svc.getOverrideForDate('2099-09-09')).resolves.toBe(2);
      expect(mockFobRepo.getOverrideForDate).toHaveBeenCalledWith('2099-09-09');
    });

    test('returns null when no override exists for the date', async () => {
      mockFobRepo.getOverrideForDate = jest.fn().mockResolvedValue(null);
      await expect(svc.getOverrideForDate('2099-09-09')).resolves.toBeNull();
    });
  });

  describe('getEffectiveCountForDate', () => {
    test('prefers override over default', async () => {
      mockFobRepo.getOverrideForDate = jest.fn().mockResolvedValue({ count: 2 });
      mockFobRepo.getDefault = jest.fn().mockResolvedValue({ count: 5 });
      await expect(svc.getEffectiveCountForDate('2099-09-09')).resolves.toBe(2);
    });

    test('falls back to default when override is missing', async () => {
      mockFobRepo.getOverrideForDate = jest.fn().mockResolvedValue(null);
      mockFobRepo.getDefault = jest.fn().mockResolvedValue({ count: 5 });
      await expect(svc.getEffectiveCountForDate('2099-09-09')).resolves.toBe(5);
    });

    test('returns null when neither override nor default is configured', async () => {
      mockFobRepo.getOverrideForDate = jest.fn().mockResolvedValue(null);
      mockFobRepo.getDefault = jest.fn().mockResolvedValue(null);
      await expect(svc.getEffectiveCountForDate('2099-09-09')).resolves.toBeNull();
    });

    test('treats zero as a real configured value, not "unset"', async () => {
      // A deliberate count of 0 must NOT fall through to the default.
      mockFobRepo.getOverrideForDate = jest.fn().mockResolvedValue({ count: 0 });
      mockFobRepo.getDefault = jest.fn().mockResolvedValue({ count: 5 });
      await expect(svc.getEffectiveCountForDate('2099-09-09')).resolves.toBe(0);
    });
  });

  describe('setDefault', () => {
    test('rejects negative counts', async () => {
      await expect(svc.setDefault(-1, 7)).rejects.toThrow(/non-negative|negative/);
    });

    test('rejects non-integer counts', async () => {
      await expect(svc.setDefault(2.5, 7)).rejects.toThrow(/integer/);
    });

    test('upserts and returns the persisted row', async () => {
      mockFobRepo.upsertDefault = jest.fn().mockResolvedValue({ count: 5 });
      const r = await svc.setDefault(5, 7);
      expect(r).toEqual({ count: 5 });
      expect(mockFobRepo.upsertDefault).toHaveBeenCalledWith(5, 7);
    });
  });

  describe('setOverride', () => {
    test('rejects an empty / null date', async () => {
      await expect(svc.setOverride('', 1, 7)).rejects.toThrow(/date/i);
      await expect(svc.setOverride(null, 1, 7)).rejects.toThrow(/date/i);
    });

    test('rejects an unparseable date', async () => {
      await expect(svc.setOverride('not-a-date', 1, 7)).rejects.toThrow(/date/i);
    });

    test('rejects negative counts', async () => {
      await expect(svc.setOverride('2099-09-09', -1, 7)).rejects.toThrow(/non-negative|negative/);
    });

    test('upserts and returns the persisted row', async () => {
      mockFobRepo.upsertOverride = jest.fn().mockResolvedValue({ date: '2099-09-09', count: 2 });
      const r = await svc.setOverride('2099-09-09', 2, 7);
      expect(r).toEqual({ date: '2099-09-09', count: 2 });
      expect(mockFobRepo.upsertOverride).toHaveBeenCalledWith('2099-09-09', 2, 7);
    });
  });

  describe('removeOverride', () => {
    test('delegates to the repo and returns true', async () => {
      mockFobRepo.deleteOverride = jest.fn().mockResolvedValue(true);
      const r = await svc.removeOverride('2099-09-09', 7);
      expect(r).toBe(true);
      expect(mockFobRepo.deleteOverride).toHaveBeenCalledWith('2099-09-09');
    });
  });

  describe('getAvailabilityForRange', () => {
    test('returns one row per day with configured / requested / available', async () => {
      // Default = 3, no overrides; 1 active fob booking spans 2099-09-09..09-10.
      mockFobRepo.getDefault = jest.fn().mockResolvedValue({ count: 3 });
      mockFobRepo.getAllOverridesInRange = jest.fn().mockResolvedValue([]);
      mockBookingRepo.findActiveFobBookingsOverlapping = jest.fn().mockResolvedValue([
        { id: 1, startDate: '2099-09-09', endDate: '2099-09-10' },
      ]);

      const out = await svc.getAvailabilityForRange('2099-09-09', '2099-09-11');
      expect(out).toEqual([
        { date: '2099-09-09', configured: 3, requested: 1, available: 2 },
        { date: '2099-09-10', configured: 3, requested: 1, available: 2 },
        { date: '2099-09-11', configured: 3, requested: 0, available: 3 },
      ]);
    });

    test('per-day overrides win over the default', async () => {
      mockFobRepo.getDefault = jest.fn().mockResolvedValue({ count: 5 });
      mockFobRepo.getAllOverridesInRange = jest.fn().mockResolvedValue([
        { date: '2099-09-10', count: 1 },
      ]);
      mockBookingRepo.findActiveFobBookingsOverlapping = jest.fn().mockResolvedValue([]);

      const out = await svc.getAvailabilityForRange('2099-09-09', '2099-09-11');
      expect(out[0].configured).toBe(5);
      expect(out[1].configured).toBe(1);
      expect(out[2].configured).toBe(5);
    });

    test('configured = null when no inventory is set; requested still counted', async () => {
      mockFobRepo.getDefault = jest.fn().mockResolvedValue(null);
      mockFobRepo.getAllOverridesInRange = jest.fn().mockResolvedValue([]);
      mockBookingRepo.findActiveFobBookingsOverlapping = jest.fn().mockResolvedValue([
        { id: 1, startDate: '2099-09-09', endDate: '2099-09-09' },
      ]);

      const out = await svc.getAvailabilityForRange('2099-09-09', '2099-09-09');
      expect(out).toEqual([
        { date: '2099-09-09', configured: null, requested: 1, available: null },
      ]);
    });

    test('requested cannot drive available below zero (but configured stays the source of truth)', async () => {
      // Defensive: if for any reason there are more bookings than inventory
      // (e.g. inventory was lowered after bookings were taken), available
      // is clamped at 0 so the UI never renders a negative number.
      mockFobRepo.getDefault = jest.fn().mockResolvedValue({ count: 1 });
      mockFobRepo.getAllOverridesInRange = jest.fn().mockResolvedValue([]);
      mockBookingRepo.findActiveFobBookingsOverlapping = jest.fn().mockResolvedValue([
        { id: 1, startDate: '2099-09-09', endDate: '2099-09-09' },
        { id: 2, startDate: '2099-09-09', endDate: '2099-09-09' },
      ]);

      const out = await svc.getAvailabilityForRange('2099-09-09', '2099-09-09');
      expect(out[0]).toEqual({ date: '2099-09-09', configured: 1, requested: 2, available: 0 });
    });

    test('rejects an inverted range', async () => {
      await expect(
        svc.getAvailabilityForRange('2099-09-10', '2099-09-09')
      ).rejects.toThrow(/start.*before|range/i);
    });
  });
});
