/**
 * Utility functions for date range operations
 */

/**
 * Checks if two date ranges overlap
 * Two date ranges overlap if: start1 <= end2 AND end1 >= start2
 * 
 * @param {string|Date} start1 - Start date of first range
 * @param {string|Date} end1 - End date of first range
 * @param {string|Date} start2 - Start date of second range
 * @param {string|Date} end2 - End date of second range
 * @returns {boolean} True if the ranges overlap, false otherwise
 */
function dateRangesOverlap(start1, end1, start2, end2) {
  const d1Start = new Date(start1);
  const d1End = new Date(end1);
  const d2Start = new Date(start2);
  const d2End = new Date(end2);

  // Normalize dates to start of day for comparison
  d1Start.setHours(0, 0, 0, 0);
  d1End.setHours(0, 0, 0, 0);
  d2Start.setHours(0, 0, 0, 0);
  d2End.setHours(0, 0, 0, 0);

  // Two ranges overlap if: start1 <= end2 AND end1 >= start2
  return d1Start <= d2End && d1End >= d2Start;
}

/**
 * Checks if a date falls within a date range (inclusive)
 * 
 * @param {string|Date} date - Date to check
 * @param {string|Date} rangeStart - Start of date range
 * @param {string|Date} rangeEnd - End of date range
 * @returns {boolean} True if date is within range, false otherwise
 */
function dateInRange(date, rangeStart, rangeEnd) {
  const checkDate = new Date(date);
  const start = new Date(rangeStart);
  const end = new Date(rangeEnd);

  // Normalize dates to start of day for comparison
  checkDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return checkDate >= start && checkDate <= end;
}

module.exports = {
  dateRangesOverlap,
  dateInRange,
};

