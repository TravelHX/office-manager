const express = require('express');
const router = express.Router();
const DeskService = require('../services/DeskService');
const { authenticate } = require('../middleware/auth');

const deskService = new DeskService();

router.get('/', authenticate, async (req, res, next) => {
  try {
    const desks = await deskService.getAllDesks();
    res.json(desks.map(d => d.toJSON()));
  } catch (error) {
    next(error);
  }
});

router.get('/available', authenticate, async (req, res, next) => {
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

    const availabilityInfo = await deskService.getAvailabilityInfo(startDate, endDate);
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

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const desk = await deskService.getDeskById(parseInt(req.params.id));
    res.json(desk.toJSON());
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

router.post('/', authenticate, async (req, res, next) => {
  try {
    const { deskNumber, location, description, isActive } = req.body;
    
    if (!deskNumber) {
      return res.status(400).json({
        error: {
          message: 'Desk number is required',
          code: 'MISSING_DESK_NUMBER',
        },
      });
    }

    const desk = await deskService.createDesk({
      deskNumber,
      location,
      description,
      isActive,
    });
    
    res.status(201).json(desk.toJSON());
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'DESK_EXISTS',
        },
      });
    }
    next(error);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const desk = await deskService.updateDesk(parseInt(req.params.id), req.body);
    res.json(desk.toJSON());
  } catch (error) {
    if (error.message === 'Desk not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'DESK_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'DESK_EXISTS',
        },
      });
    }
    next(error);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deskService.deleteDesk(parseInt(req.params.id));
    res.status(204).send();
  } catch (error) {
    if (error.message === 'Desk not found') {
      return res.status(404).json({
        error: {
          message: error.message,
          code: 'DESK_NOT_FOUND',
        },
      });
    }
    if (error.message.includes('active bookings')) {
      return res.status(409).json({
        error: {
          message: error.message,
          code: 'DESK_HAS_BOOKINGS',
        },
      });
    }
    next(error);
  }
});

module.exports = router;

