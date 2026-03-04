const { dateRangesOverlap, dateInRange } = require('../../src/backend/utils/dateUtils');

describe('Date Utils', () => {
  describe('dateRangesOverlap', () => {
    test('should return true when ranges overlap at start', () => {
      // Range 1: Jan 1-5, Range 2: Jan 3-7 (overlap Jan 3-5)
      expect(dateRangesOverlap('2026-01-01', '2026-01-05', '2026-01-03', '2026-01-07')).toBe(true);
    });

    test('should return true when ranges overlap at end', () => {
      // Range 1: Jan 3-7, Range 2: Jan 1-5 (overlap Jan 3-5)
      expect(dateRangesOverlap('2026-01-03', '2026-01-07', '2026-01-01', '2026-01-05')).toBe(true);
    });

    test('should return true when one range completely contains the other', () => {
      // Range 1: Jan 1-10, Range 2: Jan 3-5 (Range 1 contains Range 2)
      expect(dateRangesOverlap('2026-01-01', '2026-01-10', '2026-01-03', '2026-01-05')).toBe(true);
    });

    test('should return true when one range is completely within the other', () => {
      // Range 1: Jan 3-5, Range 2: Jan 1-10 (Range 1 is within Range 2)
      expect(dateRangesOverlap('2026-01-03', '2026-01-05', '2026-01-01', '2026-01-10')).toBe(true);
    });

    test('should return true when ranges are exactly the same', () => {
      // Range 1: Jan 1-5, Range 2: Jan 1-5 (exact match)
      expect(dateRangesOverlap('2026-01-01', '2026-01-05', '2026-01-01', '2026-01-05')).toBe(true);
    });

    test('should return true when ranges touch at boundaries', () => {
      // Range 1: Jan 1-5, Range 2: Jan 5-10 (touch at Jan 5)
      expect(dateRangesOverlap('2026-01-01', '2026-01-05', '2026-01-05', '2026-01-10')).toBe(true);
    });

    test('should return false when ranges do not overlap', () => {
      // Range 1: Jan 1-5, Range 2: Jan 6-10 (no overlap)
      expect(dateRangesOverlap('2026-01-01', '2026-01-05', '2026-01-06', '2026-01-10')).toBe(false);
    });

    test('should return false when ranges are separated', () => {
      // Range 1: Jan 1-3, Range 2: Jan 5-7 (separated)
      expect(dateRangesOverlap('2026-01-01', '2026-01-03', '2026-01-05', '2026-01-07')).toBe(false);
    });

    test('should handle single-day ranges correctly', () => {
      // Single day ranges
      expect(dateRangesOverlap('2026-01-01', '2026-01-01', '2026-01-01', '2026-01-01')).toBe(true);
      expect(dateRangesOverlap('2026-01-01', '2026-01-01', '2026-01-02', '2026-01-02')).toBe(false);
    });

    test('should handle Date objects', () => {
      const start1 = new Date('2026-01-01');
      const end1 = new Date('2026-01-05');
      const start2 = new Date('2026-01-03');
      const end2 = new Date('2026-01-07');
      expect(dateRangesOverlap(start1, end1, start2, end2)).toBe(true);
    });
  });

  describe('dateInRange', () => {
    test('should return true when date is within range', () => {
      expect(dateInRange('2026-01-03', '2026-01-01', '2026-01-05')).toBe(true);
    });

    test('should return true when date equals start date', () => {
      expect(dateInRange('2026-01-01', '2026-01-01', '2026-01-05')).toBe(true);
    });

    test('should return true when date equals end date', () => {
      expect(dateInRange('2026-01-05', '2026-01-01', '2026-01-05')).toBe(true);
    });

    test('should return false when date is before range', () => {
      expect(dateInRange('2025-12-31', '2026-01-01', '2026-01-05')).toBe(false);
    });

    test('should return false when date is after range', () => {
      expect(dateInRange('2026-01-06', '2026-01-01', '2026-01-05')).toBe(false);
    });

    test('should handle single-day range', () => {
      expect(dateInRange('2026-01-01', '2026-01-01', '2026-01-01')).toBe(true);
      expect(dateInRange('2026-01-02', '2026-01-01', '2026-01-01')).toBe(false);
    });
  });
});

