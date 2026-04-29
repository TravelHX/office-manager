// Phase 27b: business logic for the Key Fob inventory + per-day
// availability resolution.
//
// Spec (docs/spec.md section 22) calls for two configuration knobs and
// one read-side aggregation:
//
//   - **default count** — the daily fob inventory unless overridden;
//   - **per-date overrides** — replace the default for a specific date;
//   - **availability for a range** — for each day in [start, end],
//     report `configured` (effective count) and `requested` (count of
//     active fob-requested bookings overlapping that day), with the
//     derived `available = max(configured - requested, 0)`.
//
// Both the inventory rows and the booking aggregation live in the DB;
// the service keeps the policy (validation, override-vs-default
// resolution, range fan-out) in one place.

const FobInventoryRepository = require('../repositories/FobInventoryRepository');
const BookingRepository = require('../repositories/BookingRepository');

class FobInventoryService {
  constructor() {
    this.fobInventoryRepository = new FobInventoryRepository();
    this.bookingRepository = new BookingRepository();
  }

  async getDefault() {
    const row = await this.fobInventoryRepository.getDefault();
    return row ? row.count : null;
  }

  async getOverrideForDate(date) {
    if (!isValidDate(date)) {
      throw new Error('Invalid date');
    }
    const row = await this.fobInventoryRepository.getOverrideForDate(date);
    return row ? row.count : null;
  }

  /**
   * Effective inventory for a day: override if one is set (including 0),
   * otherwise the default, otherwise null (inventory not configured).
   *
   * `0` is a real value here — it means "no fobs available that day"
   * and must NOT fall through to the default. Tests pin this.
   */
  async getEffectiveCountForDate(date) {
    if (!isValidDate(date)) {
      throw new Error('Invalid date');
    }
    const override = await this.fobInventoryRepository.getOverrideForDate(date);
    if (override && override.count !== null && override.count !== undefined) {
      return override.count;
    }
    const def = await this.fobInventoryRepository.getDefault();
    if (def && def.count !== null && def.count !== undefined) {
      return def.count;
    }
    return null;
  }

  /**
   * Pass-through count helper used by BookingService enforcement and
   * the user-facing availability hint. Excludes a specific booking id
   * (e.g. on undo-cancel) so a booking doesn't double-count itself.
   */
  async countActiveFobBookingsForDate(date, excludeBookingId = null) {
    return this.bookingRepository.countActiveFobBookingsForDate(date, excludeBookingId);
  }

  async setDefault(count, actorId) {
    validateCount(count);
    return this.fobInventoryRepository.upsertDefault(count, actorId);
  }

  async setOverride(date, count, actorId) {
    if (!isValidDate(date)) {
      throw new Error('Invalid date');
    }
    validateCount(count);
    return this.fobInventoryRepository.upsertOverride(date, count, actorId);
  }

  async removeOverride(date /* , actorId */) {
    if (!isValidDate(date)) {
      throw new Error('Invalid date');
    }
    return this.fobInventoryRepository.deleteOverride(date);
  }

  /**
   * Build the per-day availability series for the inclusive range
   * [startDate, endDate]. One row per day:
   *   { date, configured, requested, available }
   *
   * Computation:
   *   - `configured` is the override for that date if one exists,
   *     else the default, else null;
   *   - `requested` counts active fob-requested bookings that overlap
   *     the day;
   *   - `available` = max(configured - requested, 0), or null if
   *     `configured` is null.
   *
   * The bookings query runs once for the whole range; per-day overlaps
   * are computed in JS to avoid N round-trips.
   */
  async getAvailabilityForRange(startDate, endDate) {
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      throw new Error('Invalid date range');
    }
    if (startDate > endDate) {
      throw new Error('Start date must be on or before end date');
    }

    const def = await this.fobInventoryRepository.getDefault();
    const overrides = await this.fobInventoryRepository.getAllOverridesInRange(startDate, endDate);
    const overrideByDate = new Map(overrides.map((o) => [o.date, o.count]));

    const overlapping = await this.bookingRepository.findActiveFobBookingsOverlapping(
      startDate,
      endDate
    );

    const series = [];
    for (const date of enumerateDates(startDate, endDate)) {
      const configured = overrideByDate.has(date)
        ? overrideByDate.get(date)
        : def && def.count !== null && def.count !== undefined
          ? def.count
          : null;
      const requested = overlapping.filter((b) => {
        const start = isoDate(b.startDate);
        const end = isoDate(b.endDate);
        return start <= date && end >= date;
      }).length;
      const available = configured === null ? null : Math.max(configured - requested, 0);
      series.push({ date, configured, requested, available });
    }
    return series;
  }
}

/** Strict YYYY-MM-DD validator that also rejects impossible calendar dates. */
function isValidDate(date) {
  if (!date || typeof date !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  if (isNaN(d.getTime())) return false;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}` === date;
}

function validateCount(count) {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    throw new Error('Count must be a number');
  }
  if (!Number.isInteger(count)) {
    throw new Error('Count must be an integer');
  }
  if (count < 0) {
    throw new Error('Count must be non-negative');
  }
}

function* enumerateDates(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let cur = start; cur <= end; cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000)) {
    yield isoDateFromDate(cur);
  }
}

function isoDateFromDate(d) {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Coerce a Booking model's `startDate` / `endDate` value (which can be
 * either a Date object or a YYYY-MM-DD string depending on the driver)
 * to a stable YYYY-MM-DD string for comparison.
 */
function isoDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.length >= 10 ? value.substring(0, 10) : value;
  if (value instanceof Date) return isoDateFromDate(value);
  return String(value);
}

module.exports = FobInventoryService;
