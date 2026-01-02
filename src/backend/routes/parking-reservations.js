const express = require('express');
const router = express.Router();
const ParkingReservationService = require('../services/ParkingReservationService');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');

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

router.get('/available', optionalAuthenticate, async (req, res, next) => {
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

    const availableSpaces = await reservationService.getAvailableParkingSpaces(reservationDate, timePeriod);
    res.json(availableSpaces.map(ps => ps.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.get('/check-availability', authenticate, async (req, res, next) => {
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

router.get('/:id', authenticate, async (req, res, next) => {
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

router.post('/', authenticate, async (req, res, next) => {
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

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id;
    await reservationService.cancelUserReservation(parseInt(req.params.id), userId);
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

