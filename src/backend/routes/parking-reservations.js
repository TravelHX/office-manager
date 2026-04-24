const express = require('express');
const router = express.Router();
const ParkingReservationService = require('../services/ParkingReservationService');
const { authenticate, optionalAuthenticate, requireCompleteProfile, optionalRequireCompleteProfile } = require('../middleware/auth');
const audit = require('../utils/audit-helper');

const reservationService = new ParkingReservationService();

router.get('/my-reservations', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const reservations = await reservationService.getUserReservations(userId);
    res.json(reservations);
  } catch (error) {
    next(error);
  }
});

router.get('/available', optionalAuthenticate, optionalRequireCompleteProfile, async (req, res, next) => {
  try {
    const { reservationDate, timePeriod } = req.query;
    
    if (!reservationDate || !timePeriod) {
      return res.status(400).json({
        error: {
          message: 'Reservation date and time period are required',
          code: 'MISSING_PARAMS',
        },
      });
    }

    if (!['morning', 'afternoon', 'full_day'].includes(timePeriod)) {
      return res.status(400).json({
        error: {
          message: 'Time period must be morning, afternoon, or full_day',
          code: 'INVALID_TIME_PERIOD',
        },
      });
    }

    const availabilityInfo = await reservationService.getAvailabilityInfo(reservationDate, timePeriod);
    res.json({
      availableSpaces: availabilityInfo.availableSpaces.map(ps => ps.toJSON()),
      totalSpaces: availabilityInfo.totalSpaces,
      remainingSpaces: availabilityInfo.remainingSpaces,
      bookedSpaces: availabilityInfo.bookedSpaces,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/check-availability', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const { parkingSpaceId, reservationDate, timePeriod } = req.query;
    
    if (!parkingSpaceId || !reservationDate || !timePeriod) {
      return res.status(400).json({
        error: {
          message: 'Parking space ID, reservation date, and time period are required',
          code: 'MISSING_PARAMETERS',
        },
      });
    }

    if (!['morning', 'afternoon', 'full_day'].includes(timePeriod)) {
      return res.status(400).json({
        error: {
          message: 'Time period must be morning, afternoon, or full_day',
          code: 'INVALID_TIME_PERIOD',
        },
      });
    }

    const availability = await reservationService.checkAvailability(
      parseInt(parkingSpaceId),
      reservationDate,
      timePeriod
    );
    
    res.json(availability);
  } catch (error) {
    if (error.message === 'Parking space not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_NOT_FOUND',
        },
      });
    }
    next(error);
  }
});

router.get('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const reservation = await reservationService.getReservationById(parseInt(req.params.id));
    res.json(reservation.toJSON());
  } catch (error) {
    if (error.message === 'Reservation not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'RESERVATION_NOT_FOUND',
        },
      });
    }
    next(error);
  }
});

router.post('/', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { parkingSpaceId, reservationDate, timePeriod } = req.body;
    
    if (!parkingSpaceId || !reservationDate || !timePeriod) {
      return res.status(400).json({
        error: {
          message: 'Parking space ID, reservation date, and time period are required',
          code: 'MISSING_PARAMETERS',
        },
      });
    }

    if (!['morning', 'afternoon', 'full_day'].includes(timePeriod)) {
      return res.status(400).json({
        error: {
          message: 'Time period must be morning, afternoon, or full_day',
          code: 'INVALID_TIME_PERIOD',
        },
      });
    }

    const reservation = await reservationService.createReservation(
      userId,
      parseInt(parkingSpaceId),
      reservationDate,
      timePeriod
    );

    // Phase 21d (21.8): record the reservation creation with the resource
    // and schedule so admins can reconstruct what was reserved.
    await audit.emit(req, {
      actionType: 'PARKING_RESERVATION_CREATED',
      targetType: 'parking_reservation',
      targetId: reservation.id,
      summary: `Reserved parking space ${reservation.parkingSpaceId} (${timePeriod}) on ${reservationDate}`,
      payload: {
        parking_space_id: reservation.parkingSpaceId,
        reservation_date: reservationDate,
        time_period: timePeriod,
      },
    });

    res.status(201).json(reservation.toJSON());
  } catch (error) {
    if (error.message.includes('not available') || error.message.includes('not found')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_UNAVAILABLE',
        },
      });
    }
    if (error.message.includes('date') || error.message.includes('Time period')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_DATE_OR_PERIOD',
        },
      });
    }
    next(error);
  }
});

router.post('/bulk', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { parkingSpaceIds, reservationDate, timePeriod } = req.body;
    
    if (!parkingSpaceIds || !Array.isArray(parkingSpaceIds) || parkingSpaceIds.length === 0) {
      return res.status(400).json({
        error: {
          message: 'At least one parking space ID is required',
          code: 'MISSING_PARKING_SPACE_IDS',
        },
      });
    }

    if (!reservationDate || !timePeriod) {
      return res.status(400).json({
        error: {
          message: 'Reservation date and time period are required',
          code: 'MISSING_PARAMETERS',
        },
      });
    }

    if (!['morning', 'afternoon', 'full_day'].includes(timePeriod)) {
      return res.status(400).json({
        error: {
          message: 'Time period must be morning, afternoon, or full_day',
          code: 'INVALID_TIME_PERIOD',
        },
      });
    }

    const normalisedIds = parkingSpaceIds.map(id => parseInt(id));
    const results = await reservationService.createBulkReservations(
      userId,
      normalisedIds,
      reservationDate,
      timePeriod
    );

    // Phase 21d (21.11): single aggregate audit row for the bulk call.
    const successfulCount = Array.isArray(results.successful) ? results.successful.length : 0;
    const failedCount = Array.isArray(results.failed) ? results.failed.length : 0;
    await audit.emit(req, {
      actionType: 'PARKING_RESERVATION_BULK_CREATED',
      summary: `Bulk parking reservation: ${successfulCount} succeeded, ${failedCount} failed`,
      payload: {
        parking_space_ids: normalisedIds,
        reservation_date: reservationDate,
        time_period: timePeriod,
        successful_count: successfulCount,
        failed_count: failedCount,
      },
    });

    // Return 201 if all succeeded, 207 (Multi-Status) if partial success
    const statusCode = results.failed.length === 0 ? 201 : 207;
    res.status(statusCode).json(results);
  } catch (error) {
    console.error('Bulk parking reservation creation error:', error);
    
    if (error.message.includes('not available') || error.message.includes('not found')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_UNAVAILABLE',
        },
      });
    }
    if (error.message.includes('date') || error.message.includes('Time period')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'INVALID_DATE_OR_PERIOD',
        },
      });
    }
    if (error.message.includes('overlap') || error.message.includes('already have')) {
      return res.status(400).json({
        error: {
          message: error.message,
          code: 'OVERLAPPING_RESERVATION',
        },
      });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const reservationId = parseInt(req.params.id);

    // Read reservation BEFORE cancellation so we can record the space id /
    // date / time_period in the audit payload. See the desk-booking cancel
    // route for the same pattern.
    let preCancelReservation = null;
    try {
      preCancelReservation = await reservationService.getReservationById(reservationId);
    } catch (_) {
      // Ignore — the cancel call below will surface the proper 404.
    }

    await reservationService.cancelUserReservation(reservationId, userId);

    // Phase 21d (21.8): user-driven cancel. Actor is the reservation owner.
    await audit.emit(req, {
      actionType: 'PARKING_RESERVATION_CANCELLED_BY_USER',
      targetType: 'parking_reservation',
      targetId: reservationId,
      summary: preCancelReservation
        ? `Cancelled own parking reservation for space ${preCancelReservation.parkingSpaceId}`
        : `Cancelled own parking reservation #${reservationId}`,
      payload: preCancelReservation ? {
        parking_space_id: preCancelReservation.parkingSpaceId,
        reservation_date: preCancelReservation.reservationDate,
        time_period: preCancelReservation.timePeriod,
      } : { reservation_id: reservationId },
    });

    res.status(204).send();
  } catch (error) {
    if (error.message === 'Reservation not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'RESERVATION_NOT_FOUND',
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

