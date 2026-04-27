const express = require('express');
const router = express.Router();
const BookingService = require('../services/BookingService');
const { authenticate, optionalAuthenticate, requireCompleteProfile, optionalRequireCompleteProfile } = require('../middleware/auth');
const audit = require('../utils/audit-helper');

const bookingService = new BookingService();

router.get('/my-bookings', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const bookings = await bookingService.getUserBookings(userId);
    res.json(bookings);
  } catch (error) {
    next(error);
  }
});

router.get('/available', optionalAuthenticate, optionalRequireCompleteProfile, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Start date and end date are required',
          code: 'MISSING_DATES',
        },
      });
    }

    const availabilityInfo = await bookingService.getAvailabilityInfo(startDate, endDate);
    res.json({
      availableDesks: availabilityInfo.availableDesks.map(d => d.toJSON()),
      totalDesks: availabilityInfo.totalDesks,
      remainingDesks: availabilityInfo.remainingDesks,
      bookedDesks: availabilityInfo.bookedDesks,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/check-availability', authenticate, async (req, res, next) => {
  try {
    const { deskId, startDate, endDate } = req.query;
    
    if (!deskId || !startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Desk ID, start date, and end date are required',
          code: 'MISSING_PARAMETERS',
        },
      });
    }

    const availability = await bookingService.checkAvailability(
      parseInt(deskId),
      startDate,
      endDate
    );
    
    res.json(availability);
  } catch (error) {
    if (error.message === 'Desk not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'DESK_NOT_FOUND',
        },
      });
    }
    next(error);
  }
});

router.get('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const booking = await bookingService.getBookingById(parseInt(req.params.id));
    res.json(booking.toJSON());
  } catch (error) {
    if (error.message === 'Booking not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'BOOKING_NOT_FOUND',
        },
      });
    }
    next(error);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { deskId, startDate, endDate } = req.body;
    
    if (!deskId || !startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Desk ID, start date, and end date are required',
          code: 'MISSING_PARAMETERS',
        },
      });
    }

    const booking = await bookingService.createBooking(
      userId,
      parseInt(deskId),
      startDate,
      endDate
    );

    // Phase 21d (21.7): record the new booking. Payload carries the resource
    // ids and dates so admins can reconstruct what was booked without
    // joining against `bookings` (which may itself be mutated later).
    await audit.emit(req, {
      actionType: 'DESK_BOOKING_CREATED',
      targetType: 'booking',
      targetId: booking.id,
      summary: `Booked desk ${booking.deskId} for ${startDate} to ${endDate}`,
      payload: {
        desk_id: booking.deskId,
        start_date: startDate,
        end_date: endDate,
      },
    });

    res.status(201).json(booking.toJSON());
  } catch (error) {
    // Log the error for debugging
    console.error('Booking creation error:', error);
    
    if (error.message.includes('not available') || error.message.includes('not found')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'DESK_UNAVAILABLE',
        },
      });
    }
    if (error.message.includes('date')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_DATE',
        },
      });
    }
    // Handle foreign key constraint violations
    if (error.code && (error.code.startsWith('ER_') || error.message.includes('foreign key'))) {
      return res.status(400).json({
        error: {
          message: error.message.includes('user_id') 
            ? 'Invalid user ID. User does not exist.'
            : error.message.includes('desk_id')
            ? 'Invalid desk ID. Desk does not exist.'
            : 'Database constraint violation: ' + error.message,
          code: 'FOREIGN_KEY_ERROR',
        },
      });
    }
    next(error);
  }
});

router.post('/bulk', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { deskIds, startDate, endDate } = req.body;
    
    if (!deskIds || !Array.isArray(deskIds) || deskIds.length === 0) {
      return res.status(400).json({
        error: {
          message: 'At least one desk ID is required',
          code: 'MISSING_DESK_IDS',
        },
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: {
          message: 'Start date and end date are required',
          code: 'MISSING_DATES',
        },
      });
    }

    const normalisedDeskIds = deskIds.map(id => parseInt(id));
    const results = await bookingService.createBulkBookings(
      userId,
      normalisedDeskIds,
      startDate,
      endDate
    );

    // Phase 21d (21.11): one aggregate audit row per bulk call (not per
    // individual desk) to keep the audit stream readable. The counts and
    // the requested desk list are captured so an admin can correlate.
    const successfulCount = Array.isArray(results.successful) ? results.successful.length : 0;
    const failedCount = Array.isArray(results.failed) ? results.failed.length : 0;
    await audit.emit(req, {
      actionType: 'DESK_BOOKING_BULK_CREATED',
      summary: `Bulk desk booking: ${successfulCount} succeeded, ${failedCount} failed`,
      payload: {
        desk_ids: normalisedDeskIds,
        start_date: startDate,
        end_date: endDate,
        successful_count: successfulCount,
        failed_count: failedCount,
      },
    });

    // Return 201 if all succeeded, 207 (Multi-Status) if partial success
    const statusCode = results.failed.length === 0 ? 201 : 207;
    res.status(statusCode).json(results);
  } catch (error) {
    console.error('Bulk booking creation error:', error);
    
    if (error.message.includes('not available') || error.message.includes('not found')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'DESK_UNAVAILABLE',
        },
      });
    }
    if (error.message.includes('date')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_DATE',
        },
      });
    }
    if (error.message.includes('overlap') || error.message.includes('already have')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'OVERLAPPING_BOOKING',
        },
      });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const bookingId = parseInt(req.params.id);

    // Read booking BEFORE cancellation so we can record desk_id / dates
    // in the audit payload (cancelUserBooking returns the cancel result,
    // not the pre-cancel row, and cancellation may null out fields).
    let preCancelBooking = null;
    try {
      preCancelBooking = await bookingService.getBookingById(bookingId);
    } catch (_) {
      // Ignore — the service call below will surface a proper 404.
    }

    await bookingService.cancelUserBooking(bookingId, userId);

    // Phase 21d (21.7): user-driven cancel. Actor is the booking owner.
    await audit.emit(req, {
      actionType: 'DESK_BOOKING_CANCELLED_BY_USER',
      targetType: 'booking',
      targetId: bookingId,
      summary: preCancelBooking
        ? `Cancelled own booking for desk ${preCancelBooking.deskId}`
        : `Cancelled own booking #${bookingId}`,
      payload: preCancelBooking ? {
        desk_id: preCancelBooking.deskId,
        start_date: preCancelBooking.startDate,
        end_date: preCancelBooking.endDate,
      } : { booking_id: bookingId },
    });

    // Phase 23c: tell the client how long it has to undo the cancellation.
    // The client uses this to gate the Undo toast timer so backend and UI
    // stay in sync if the window changes.
    res.setHeader('X-Undo-Window-Ms', String(BookingService.UNDO_CANCEL_WINDOW_MS));
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Booking not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'BOOKING_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('only cancel your own')) {
      return res.status(403).json({
        error: {
          message: error.message,
          code: 'FORBIDDEN',
        },
      });
    }
    if (error.message.includes('already cancelled')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'ALREADY_CANCELLED',
        },
      });
    }
    next(error);
  }
});

// Phase 23c: Undo a user's own recent self-cancel. Owner-only, time-boxed,
// and gated on current desk availability — see BookingService.restoreCancelledBooking
// for the full rule set.
router.post('/:id/undo-cancel', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const bookingId = parseInt(req.params.id);

    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return res.status(400).json({
        error: {
          message: 'Invalid booking id',
          code: 'INVALID_BOOKING_ID',
        },
      });
    }

    const restored = await bookingService.restoreCancelledBooking(bookingId, userId);

    // Phase 21d / 23c: emit DESK_BOOKING_RESTORED. Actor is the booking
    // owner (undo is self-only). Payload mirrors the create/cancel payloads
    // so an admin can reconstruct the resource + date range from a single
    // event and can see which undo window was in force at the time.
    await audit.emit(req, {
      actionType: 'DESK_BOOKING_RESTORED',
      targetType: 'booking',
      targetId: bookingId,
      summary: `Undid cancellation of booking #${bookingId} (desk ${restored.deskId})`,
      payload: {
        desk_id: restored.deskId,
        start_date: restored.startDate,
        end_date: restored.endDate,
        undo_within_ms: BookingService.UNDO_CANCEL_WINDOW_MS,
      },
    });

    res.status(200).json(restored.toJSON());
  } catch (error) {
    if (error.message === 'Booking not found') {
      return res.status(404).json({
        error: { message: error.message, code: 'BOOKING_NOT_FOUND' },
      });
    }
    if (
      error.message.includes('only undo your own')
      || error.message.includes('Only self-cancellations')
    ) {
      return res.status(403).json({
        error: { message: error.message, code: 'FORBIDDEN' },
      });
    }
    if (error.message === 'Booking is not cancelled') {
      return res.status(400).json({
        error: { message: error.message, code: 'NOT_CANCELLED' },
      });
    }
    if (error.message === 'Undo window has expired') {
      return res.status(400).json({
        error: { message: error.message, code: 'UNDO_EXPIRED' },
      });
    }
    if (error.message.includes('no longer available')) {
      return res.status(409).json({
        error: { message: error.message, code: 'DESK_UNAVAILABLE' },
      });
    }
    next(error);
  }
});

module.exports = router;

