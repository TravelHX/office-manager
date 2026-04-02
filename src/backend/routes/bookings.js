const express = require('express');
const router = express.Router();
const BookingService = require('../services/BookingService');
const { authenticate, optionalAuthenticate, requireCompleteProfile, optionalRequireCompleteProfile } = require('../middleware/auth');

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

    const results = await bookingService.createBulkBookings(
      userId,
      deskIds.map(id => parseInt(id)),
      startDate,
      endDate
    );
    
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
    await bookingService.cancelUserBooking(parseInt(req.params.id), userId);
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

module.exports = router;

