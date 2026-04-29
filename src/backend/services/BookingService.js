const BookingRepository = require('../repositories/BookingRepository');
const DeskRepository = require('../repositories/DeskRepository');
const DeskService = require('./DeskService');
const FobInventoryService = require('./FobInventoryService');
const Booking = require('../models/Booking');
const { dateRangesOverlap } = require('../utils/dateUtils');

/**
 * Phase 27b: Error class used by createBooking / createBulkBookings
 * when an inventory check refuses a fob-requested booking. The route
 * handler unwraps `code` and `offendingDates` to build the API response.
 */
class FobUnavailableError extends Error {
  constructor(offendingDates) {
    const list = (offendingDates || []).join(', ');
    super(`FOB_UNAVAILABLE: no fob remaining on ${list}`);
    this.name = 'FobUnavailableError';
    this.code = 'FOB_UNAVAILABLE';
    this.offendingDates = (offendingDates || []).slice().sort();
  }
}

// Phase 23c: window within which a user can Undo their own desk cancel.
// Spec section 18 allows 15-30 s; 30 s gives users time to notice and click
// the Undo toast without being so long that a conflicting booking is likely.
// Exposed as a constant so tests can import it and the value appears once.
const UNDO_CANCEL_WINDOW_MS = 30_000;

class BookingService {
  constructor() {
    this.bookingRepository = new BookingRepository();
    this.deskRepository = new DeskRepository();
    this.deskService = new DeskService();
    // Phase 27b: lazily-resolved fob inventory dependency. The service
    // constructor instantiates one for production; tests inject a mock
    // by overwriting `this.fobInventoryService` after construction.
    this.fobInventoryService = new FobInventoryService();
  }

  /**
   * Phase 27b: enforce fob inventory across [startDate, endDate]. Throws
   * a FobUnavailableError listing the offending dates if any single day
   * has no remaining inventory. When inventory is not configured for
   * a day (effective count is null), the day is allowed unconditionally
   * per spec section 22.
   *
   * @param {string} startDate YYYY-MM-DD
   * @param {string} endDate   YYYY-MM-DD
   * @param {{extraRequestsPerDay?: Map<string, number>}} [options]
   *   `extraRequestsPerDay` lets callers (e.g. createBulkBookings)
   *   simulate fobs already granted in the same atomic operation that
   *   haven't yet hit the database.
   */
  async _checkFobInventory(startDate, endDate, options = {}) {
    const extra = options.extraRequestsPerDay instanceof Map
      ? options.extraRequestsPerDay
      : new Map();
    const offendingDates = [];
    for (const date of enumerateInclusiveDates(startDate, endDate)) {
      const configured = await this.fobInventoryService.getEffectiveCountForDate(date);
      if (configured === null || configured === undefined) {
        // No inventory configured for this day -> tracked but not blocked.
        continue;
      }
      const used = await this.fobInventoryService.countActiveFobBookingsForDate(date);
      const inFlight = extra.get(date) || 0;
      if (used + inFlight >= configured) {
        offendingDates.push(date);
      }
    }
    if (offendingDates.length > 0) {
      throw new FobUnavailableError(offendingDates);
    }
  }

  /**
   * Phase 27a: `options.fobRequested` is the new optional Key Fob request
   * flag. Storage-only at this layer — Phase 27b adds the inventory
   * enforcement that can refuse the booking when the flag is true and
   * the configured fob count is exhausted.
   */
  async createBooking(userId, deskId, startDate, endDate, options = {}) {
    const fobRequested = !!(options && options.fobRequested);
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new Error('Cannot book desks for past dates');
    }

    const desk = await this.deskRepository.findById(deskId);
    if (!desk) {
      throw new Error('Desk not found');
    }

    if (!desk.isActive) {
      throw new Error('Desk is not available');
    }

    // Validate: Check if user already has overlapping desk bookings
    const userOverlaps = await this.bookingRepository.findOverlappingUserBookings(
      userId,
      startDate,
      endDate
    );
    if (userOverlaps.length > 0) {
      const conflictingBooking = userOverlaps[0];
      throw new Error(
        `You already have a desk booking (Desk ${conflictingBooking.deskId}) for dates that overlap with ${startDate} to ${endDate}. ` +
        `Your existing booking is from ${conflictingBooking.startDate} to ${conflictingBooking.endDate}. ` +
        `You cannot book multiple desks for overlapping periods.`
      );
    }

    // Validate: Check if desk is already booked by another user
    const availability = await this.deskService.checkDeskAvailability(deskId, startDate, endDate);
    if (!availability.available) {
      if (availability.conflicts && availability.conflicts.length > 0) {
        const conflict = availability.conflicts[0];
        throw new Error(
          `Desk ${desk.deskNumber || deskId} is already booked by another user for dates that overlap with ${startDate} to ${endDate}. ` +
          `The existing booking is from ${conflict.startDate} to ${conflict.endDate}.`
        );
      }
      throw new Error('Desk is not available for the selected date range');
    }

    // Phase 27b: enforce fob inventory only when the user actually
    // ticked the box. When inventory is not configured for any day in
    // the range, the helper is a no-op.
    if (fobRequested) {
      await this._checkFobInventory(startDate, endDate);
    }

    const booking = new Booking({
      user_id: userId,
      desk_id: deskId,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
      fob_requested: fobRequested,
    });

    return await this.bookingRepository.create(booking);
  }

  async getBookingById(id) {
    const booking = await this.bookingRepository.findById(id);
    if (!booking) {
      throw new Error('Booking not found');
    }
    return booking;
  }

  async getUserBookings(userId) {
    return await this.bookingRepository.findByUserId(userId);
  }

  async getAllBookings() {
    return await this.bookingRepository.findAll();
  }

  async cancelBooking(bookingId, cancelledBy, reason = null) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Booking is already cancelled');
    }

    return await this.bookingRepository.cancel(bookingId, cancelledBy, reason);
  }

  async cancelUserBooking(bookingId, userId) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new Error('You can only cancel your own bookings');
    }

    return await this.cancelBooking(bookingId, userId);
  }

  /**
   * Phase 23c: Undo a user's own desk cancel, provided:
   *   (a) the booking was cancelled by *this* user (not an admin);
   *   (b) the cancel happened within UNDO_CANCEL_WINDOW_MS;
   *   (c) the desk is still available for the original date range
   *       (no conflicting booking has been created in the meantime).
   *
   * On success the cancellation metadata is cleared and the booking is
   * marked `active` again. Errors are distinct so the route can translate
   * each to the correct HTTP status / code:
   *   - `Booking not found`                      -> 404
   *   - `You can only undo your own cancellation`-> 403
   *   - `Only self-cancellations can be undone`  -> 403
   *   - `Booking is not cancelled`               -> 400
   *   - `Undo window has expired`                -> 400
   *   - `Desk is no longer available`            -> 409
   *
   * @param {number} bookingId
   * @param {number} userId   ID of the currently-authenticated user.
   * @param {Date}   [now=new Date()]  Override for deterministic tests.
   * @returns {Promise<Booking>}
   */
  async restoreCancelledBooking(bookingId, userId, now = new Date()) {
    const booking = await this.bookingRepository.findById(bookingId);
    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.userId !== userId) {
      throw new Error('You can only undo your own cancellation');
    }

    if (booking.status !== 'cancelled') {
      throw new Error('Booking is not cancelled');
    }

    // Admin-initiated cancels are out of scope for undo (spec section 18:
    // "initial scope: user self-cancel only"). `cancelledBy` is the user id
    // that triggered the cancel — if it's not this user, refuse.
    if (booking.cancelledBy !== userId) {
      throw new Error('Only self-cancellations can be undone');
    }

    const cancelledAt = booking.cancelledAt ? new Date(booking.cancelledAt) : null;
    if (!cancelledAt || isNaN(cancelledAt.getTime())) {
      // Shouldn't happen for a cancelled row but guard against a partial
      // write or a manual SQL poke that cleared the timestamp.
      throw new Error('Undo window has expired');
    }
    const elapsedMs = now.getTime() - cancelledAt.getTime();
    if (elapsedMs > UNDO_CANCEL_WINDOW_MS) {
      throw new Error('Undo window has expired');
    }

    // Re-check desk availability excluding THIS booking: while we were
    // cancelled, someone else (or the same user on another desk) could
    // have claimed the desk for overlapping dates. If so, undo is refused.
    const availability = await this.deskService.checkDeskAvailability(
      booking.deskId,
      booking.startDate,
      booking.endDate,
      booking.id
    );
    if (!availability.available) {
      throw new Error('Desk is no longer available for the original dates');
    }

    return await this.bookingRepository.restore(booking.id);
  }

  async checkAvailability(deskId, startDate, endDate) {
    return await this.deskService.checkDeskAvailability(deskId, startDate, endDate);
  }

  async getAvailableDesks(startDate, endDate) {
    return await this.deskService.getAvailableDesks(startDate, endDate);
  }

  async getAvailabilityInfo(startDate, endDate) {
    return await this.deskService.getAvailabilityInfo(startDate, endDate);
  }

  /**
   * Phase 27a: bulk variant accepts the same `options.fobRequested` flag,
   * applied uniformly to every booking the call creates. (Per-resource
   * fob requests are out of scope; the spec scopes the flag to the whole
   * booking, including all selected desks in a bulk operation.)
   */
  async createBulkBookings(userId, deskIds, startDate, endDate, options = {}) {
    const fobRequested = !!(options && options.fobRequested);
    if (!deskIds || !Array.isArray(deskIds) || deskIds.length === 0) {
      throw new Error('At least one desk ID is required');
    }

    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error('Invalid date format');
    }

    if (start > end) {
      throw new Error('Start date must be before or equal to end date');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      throw new Error('Cannot book desks for past dates');
    }

    // Validate: Check if user already has overlapping desk bookings
    const userOverlaps = await this.bookingRepository.findOverlappingUserBookings(
      userId,
      startDate,
      endDate
    );
    if (userOverlaps.length > 0) {
      const conflictingBooking = userOverlaps[0];
      throw new Error(
        `You already have a desk booking (Desk ${conflictingBooking.deskId}) for dates that overlap with ${startDate} to ${endDate}. ` +
        `Your existing booking is from ${conflictingBooking.startDate} to ${conflictingBooking.endDate}. ` +
        `You cannot book multiple desks for overlapping periods.`
      );
    }

    // Validate all desks exist and are available
    const results = {
      successful: [],
      failed: [],
      errors: [],
    };

    // Phase 27b: track fobs already granted within this same bulk call
    // so the running inventory check denies later desks once the day's
    // remaining count hits zero. Keyed by date.
    const inFlightFobsPerDay = new Map();

    for (const deskId of deskIds) {
      try {
        const desk = await this.deskRepository.findById(deskId);
        if (!desk) {
          results.failed.push({ deskId, reason: 'Desk not found' });
          results.errors.push(`Desk ${deskId} not found`);
          continue;
        }

        if (!desk.isActive) {
          results.failed.push({ deskId, reason: 'Desk is not available' });
          results.errors.push(`Desk ${desk.deskNumber || deskId} is not available`);
          continue;
        }

        // Check if desk is already booked by another user
        const availability = await this.deskService.checkDeskAvailability(deskId, startDate, endDate);
        if (!availability.available) {
          if (availability.conflicts && availability.conflicts.length > 0) {
            const conflict = availability.conflicts[0];
            results.failed.push({ deskId, reason: 'Desk already booked' });
            results.errors.push(
              `Desk ${desk.deskNumber || deskId} is already booked by another user for dates that overlap with ${startDate} to ${endDate}`
            );
          } else {
            results.failed.push({ deskId, reason: 'Desk not available' });
            results.errors.push(`Desk ${desk.deskNumber || deskId} is not available for the selected date range`);
          }
          continue;
        }

        // Phase 27b: per-desk fob inventory check (only when fob
        // requested). The check accounts for fobs already granted
        // earlier in this loop so a single bulk call can't oversell.
        if (fobRequested) {
          try {
            await this._checkFobInventory(startDate, endDate, {
              extraRequestsPerDay: inFlightFobsPerDay,
            });
          } catch (fobErr) {
            if (fobErr && fobErr.code === 'FOB_UNAVAILABLE') {
              const dateList = (fobErr.offendingDates || []).join(', ');
              results.failed.push({
                deskId,
                reason: 'Fob unavailable',
                code: 'FOB_UNAVAILABLE',
                offendingDates: fobErr.offendingDates,
              });
              results.errors.push(
                `Desk ${desk.deskNumber || deskId}: fob unavailable on ${dateList}`
              );
              continue;
            }
            throw fobErr;
          }
        }

        // Create the booking
        const booking = new Booking({
          user_id: userId,
          desk_id: deskId,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          fob_requested: fobRequested,
        });

        const createdBooking = await this.bookingRepository.create(booking);
        results.successful.push(createdBooking.toJSON());
        // Phase 27b: bump the running per-day inventory counter so the
        // next desk in this bulk call sees this fob as already taken.
        if (fobRequested) {
          for (const date of enumerateInclusiveDates(startDate, endDate)) {
            inFlightFobsPerDay.set(date, (inFlightFobsPerDay.get(date) || 0) + 1);
          }
        }
      } catch (error) {
        results.failed.push({ deskId, reason: error.message });
        results.errors.push(`Desk ${deskId}: ${error.message}`);
      }
    }

    if (results.successful.length === 0) {
      throw new Error(`Failed to book any desks: ${results.errors.join('; ')}`);
    }

    return results;
  }
}

/**
 * Inclusive date enumerator over [startDate, endDate] using UTC midnight
 * stepping. Phase 27b uses this for the day-by-day fob-inventory loop;
 * keeping it module-local avoids a new utils file.
 */
function* enumerateInclusiveDates(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let cur = new Date(start.getTime()); cur <= end; cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000)) {
    const yyyy = cur.getUTCFullYear();
    const mm = String(cur.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(cur.getUTCDate()).padStart(2, '0');
    yield `${yyyy}-${mm}-${dd}`;
  }
}

module.exports = BookingService;
module.exports.UNDO_CANCEL_WINDOW_MS = UNDO_CANCEL_WINDOW_MS;
module.exports.FobUnavailableError = FobUnavailableError;

