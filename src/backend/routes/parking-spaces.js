const express = require('express');
const router = express.Router();
const ParkingSpaceService = require('../services/ParkingSpaceService');
const { authenticate, optionalAuthenticate, requireCompleteProfile, optionalRequireCompleteProfile } = require('../middleware/auth');

const parkingSpaceService = new ParkingSpaceService();

router.get('/', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const parkingSpaces = await parkingSpaceService.getAllParkingSpaces();
    res.json(parkingSpaces.map(ps => ps.toJSON()));
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

    const availabilityInfo = await parkingSpaceService.getAvailabilityInfo(reservationDate, timePeriod);
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

router.get('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const parkingSpace = await parkingSpaceService.getParkingSpaceById(parseInt(req.params.id));
    res.json(parkingSpace.toJSON());
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

router.post('/', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    const { spaceNumber, location, description, isActive } = req.body;
    
    if (!spaceNumber) {
      return res.status(400).json({
        error: {
          message: 'Space number is required',
          code: 'MISSING_SPACE_NUMBER',
        },
      });
    }

    const parkingSpace = await parkingSpaceService.createParkingSpace({
      spaceNumber,
      location,
      description,
      isActive,
    });
    
    res.status(201).json(parkingSpace.toJSON());
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_EXISTS',
        },
      });
    }
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const parkingSpace = await parkingSpaceService.updateParkingSpace(parseInt(req.params.id), req.body);
    res.json(parkingSpace.toJSON());
  } catch (error) {
    if (error.message === 'Parking space not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_EXISTS',
        },
      });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, requireCompleteProfile, async (req, res, next) => {
  try {
    await parkingSpaceService.deleteParkingSpace(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Parking space not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('active reservations')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'PARKING_SPACE_HAS_RESERVATIONS',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

