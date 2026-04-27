const BookingRepository = require('../repositories/BookingRepository');
const DeskRepository = require('../repositories/DeskRepository');
const DeskService = require('./DeskService');
const Booking = require('../models/Booking');
const { dateRangesOverlap } = require('../utils/dateUtils');

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
  }

  async createBooking(userId, deskId, startDate, endDate) {
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

    const booking = new Booking({
      user_id: userId,
      desk_id: deskId,
      start_date: startDate,
      end_date: endDate,
      status: 'active',
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

  async createBulkBookings(userId, deskIds, startDate, endDate) {
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

        // Create the booking
        const booking = new Booking({
          user_id: userId,
          desk_id: deskId,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
        });

        const createdBooking = await this.bookingRepository.create(booking);
        results.successful.push(createdBooking.toJSON());
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

module.exports = BookingService;
module.exports.UNDO_CANCEL_WINDOW_MS = UNDO_CANCEL_WINDOW_MS;

